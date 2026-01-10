# app.py
from flask import Flask, render_template, request, jsonify
from flask_migrate import Migrate
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from sqlalchemy import func, case, or_
import feedparser
import cohere
from collections import Counter
import time
import psycopg2
from psycopg2 import sql
import re
import pandas as pd
# ================== DATABASE CONNECTION ==================
conn = psycopg2.connect(
    host="localhost",
    database="postgres",
    user="postgres",
    password="aiml72"  # Change if needed
)

def query_db(sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    colnames = [desc[0] for desc in cur.description]
    cur.close()
    return pd.DataFrame(rows, columns=colnames)

# Load environment variables
load_dotenv()

cohere_client = cohere.Client(os.getenv("COHERE_API_KEY"))

from models import db, Voter, Task, Communication, Report, Booth, Segment

# App Setup
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.getenv("SECRET_KEY", "supersecret")

# Bind db to app
db.init_app(app)
migrate = Migrate(app, db)

# ========================================
# Initialize Cohere (Chatbot)
# ========================================
cohere_key = os.getenv("COHERE_API_KEY")
co = cohere.Client(cohere_key) if cohere_key else None

# ========================================
# Routes - HTML Pages
# ========================================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/worker")
def worker_dashboard():
    return render_template("party-worker-dashboard.html")

@app.route("/admin")
def admin_dashboard():
    return render_template("admin-dashboard.html")

@app.route("/candidate")
def candidate_dashboard():
    return render_template("candidate-dashboard.html")

# ---- Chatbot Integration ----
@app.route("/chatpage")
def chatbot_page():
    """Renders the integrated chatbot interface."""
    return render_template("chatbot.html")



# -------------------------
# Intent detection utilities
# -------------------------
def classify_intent(text):
    t = text.lower()
    # stronger pattern matches
    if re.search(r'\bbooth\b|\bbooth\s*\d+|\bbooth\:\b', t):
        return "booth"
    if re.search(r'\bfemale\b|\bwomen\b|\bwoman\b', t):
        return "gender_female"
    if re.search(r'\bmale\b|\bmen\b|\bman\b', t) and not re.search(r'\bfemale\b', t):
        return "gender_male"
    if re.search(r'\bissue\b|\bissues\b|\bproblem\b|\bconcern\b', t):
        return "issues"
    if re.search(r'\bage\b|\byouth\b|\b18\b|\b25\b|\b26\b|\b40\b', t):
        return "age"
    if re.search(r'\bswing\b|\bneutral\b', t):
        return "swing"
    if re.search(r'\bwin\b|\bchance\b|\bprobability\b|\bpercent\b', t):
        return "win_probability"
    return "general"

def detect_booth_number(text):
    m = re.search(r'(\bbooth\s*#?\s*(\d+)\b)|(\b(\d{1,4})\b)', text.lower())
    if not m:
        return None
    # prefer explicit "booth N"
    if m.group(2):
        return int(m.group(2))
    # fallback to any number
    for g in m.groups():
        if g and g.isdigit():
            return int(g)
    return None

# -------------------------
# Analytics / Insight functions
# Note: your table is public.voter_list and columns confirmed:
# "Name","Age","Gender","Political Affiliation","House number","Latitude","Longitude","Key Issues"
# -------------------------
def gender_insight(gender):
    """Return formatted gender-based affiliation counts with percentages and recommendations."""
    # Use parameterized query, but column names with spaces must be quoted.
    sql_text = """
        SELECT "Political Affiliation" AS affiliation, COUNT(*) AS cnt
        FROM public.voter_list
        WHERE LOWER("Gender") = LOWER(%s)
        GROUP BY "Political Affiliation";
    """
    df = query_db(sql_text, (gender,))
    if df.empty:
        return f"No voter records found for gender: {gender}"

    total = int(df['cnt'].sum())
    # normalize affiliation values (capitalize)
    df['affiliation'] = df['affiliation'].astype(str).str.title()

    # order preference
    order = ["Supporter", "Neutral", "Opponent"]
    df['order'] = df['affiliation'].apply(lambda v: order.index(v) if v in order else 99)
    df = df.sort_values(by='order')

    emojis = {"Supporter": "✅", "Neutral": "⚪", "Opponent": "❌"}
    lines = [f"📊 Gender Insight: {gender} Voters", f"Total: {total} voters\n"]
    for _, row in df.iterrows():
        aff = row['affiliation']
        cnt = int(row['cnt'])
        pct = round((cnt / total) * 100, 1) if total > 0 else 0.0
        lines.append(f"{emojis.get(aff, '•')} {aff}: {cnt} voters ({pct}%)")
    # add a short recommendation
    neutral_row = df[df['affiliation'].str.lower() == 'neutral']
    if not neutral_row.empty:
        neutral_pct = round((int(neutral_row.iloc[0]['cnt']) / total) * 100, 1)
        lines.append(f"\n📌 Recommendation: Focus targeted outreach to neutral {gender.lower()} voters ({neutral_pct}%). Use women's groups / local meetings.")
    return "\n".join(lines)

def top_issue_insight(limit=5):
    """Unnest key issues separated by commas and return top N."""
    sql_text = """
        SELECT issue, SUM(cnt) AS cnt FROM (
            SELECT unnest(string_to_array("Key Issues", ','))::text AS issue, COUNT(*)::int AS cnt
            FROM public.voter_list
            GROUP BY issue
        ) t
        GROUP BY issue
        ORDER BY cnt DESC
        LIMIT %s;
    """
    df = query_db(sql_text, (limit,))
    if df.empty:
        return "No issue data available."
    lines = ["🔥 Top Voter Issues:"]
    for _, row in df.iterrows():
        issue = str(row['issue']).strip().title()
        cnt = int(row['cnt'])
        lines.append(f"• {issue}: {cnt} voters")
    return "\n".join(lines)

def age_group_insight():
    sql_text = """
        SELECT "Age", COUNT(*) AS cnt
        FROM public.voter_list
        GROUP BY "Age"
        ORDER BY "Age";
    """
    df = query_db(sql_text)
    if df.empty:
        return "No age data available."
    lines = ["🎯 Age Distribution:"]
    total = int(df['cnt'].sum())
    for _, row in df.iterrows():
        age = row['Age']
        cnt = int(row['cnt'])
        pct = round((cnt / total) * 100, 1) if total > 0 else 0.0
        lines.append(f"• Age {age}: {cnt} voters ({pct}%)")
    return "\n".join(lines)

def booth_supporter_insight(booth_number):
    if not booth_number:
        return "Please provide a booth number (e.g., 'Booth 12')."

    # Some data may not have explicit booth column; if so, we try matching "House number" or any booth column — adjust if needed.
    # Here we assume booth_number is stored in "House number" or as numeric in "House number" field. If you have a specific booth column change query.
    # We'll search by "House number" containing booth_number OR nearby 'booth_number' if exists.
    # First try a numeric equality on "House number" if it stores booth numbers; otherwise pattern match.
    # We'll attempt both: equality and LIKE.
    sql_text = """
        SELECT "Political Affiliation" AS affiliation, COUNT(*) AS cnt
        FROM public.voter_list
        WHERE "House number"::text ILIKE %s OR "House number"::text ILIKE %s
        GROUP BY "Political Affiliation";
    """
    pattern = f"%{booth_number}%"
    df = query_db(sql_text, (pattern, pattern))
    # If no rows — try filtering by Latitude/Longitude proximity not implemented here (need geo)
    if df.empty:
        return f"No direct data found for Booth {booth_number}. Try 'Booth {booth_number}' using your local booth identifier."
    total = int(df['cnt'].sum())
    df['affiliation'] = df['affiliation'].astype(str).str.title()
    lines = [f"📌 Booth {booth_number} Summary (matching House number):", f"Total records: {total}"]
    for _, row in df.iterrows():
        aff = row['affiliation']
        cnt = int(row['cnt'])
        pct = round((cnt / total) * 100, 1) if total>0 else 0.0
        lines.append(f"• {aff}: {cnt} ({pct}%)")
    lines.append("\n🎯 Recommendation: Prioritize door-to-door for neutral voters and phone outreach for opponents.")
    return "\n".join(lines)

def swing_voter_insight():
    sql_text = """
        SELECT "Age", COUNT(*) AS cnt
        FROM public.voter_list
        WHERE LOWER("Political Affiliation") = 'neutral'
        GROUP BY "Age"
        ORDER BY cnt DESC
        LIMIT 10;
    """
    df = query_db(sql_text)
    if df.empty:
        return "No swing voter data found."
    lines = ["🎯 Swing Voter Profile (Top groups by count):"]
    for _, row in df.iterrows():
        age = row['Age']
        cnt = int(row['cnt'])
        lines.append(f"• Age {age}: {cnt} neutral/swing voters")
    lines.append("\n📌 Recommendation: Run targeted youth outreach & issue campaigns.")
    return "\n".join(lines)

def win_probability():
    sql_text = """
        SELECT LOWER("Political Affiliation") AS aff, COUNT(*) AS cnt
        FROM public.voter_list
        GROUP BY LOWER("Political Affiliation");
    """
    df = query_db(sql_text)
    if df.empty:
        return "No affiliation data."
    total = int(df['cnt'].sum())
    supporters = int(df[df['aff']=='supporter']['cnt'].sum()) if 'supporter' in df['aff'].values else 0
    prob = round((supporters / total) * 100, 1) if total>0 else 0.0
    return f"📈 Estimated Supporter Share: {supporters}/{total} ({prob}%) — not a true probability but a quick indicator."

# -------------------------
# LLM / fallback response
# -------------------------
def llm_response(user_text):
    """If Cohere client present, use it. Otherwise fall back to rule-based responses."""
    if co:
        try:
            # Simple chat call (Cohere SDK usage may differ by version)
            resp = co.chat(message=user_text, chat_history=[], model="command-a-03-2025")
            return resp.text
        except Exception as e:
            print("Cohere error:", e)
    # Fallback rule-based short responses for general queries
    t = user_text.lower()
    if "campaign" in t or "strategy" in t:
        return ("Campaign strategy usually includes voter outreach, door-to-door canvassing, targeted messaging, "
                "volunteer mobilization, and monitoring booths. Be specific and test messages on small segments first.")
    if "voting" in t:
        return "Voting is the act of making a choice in an election. Laws and procedures vary by country."
    if "hello" in t or "hi" in t:
        return "Hi — I can give you live voter analytics (ask 'female voters' or 'booth 12') or general campaign advice."
    return ("I can help with campaign analytics (ask about 'female voters', 'booth 12', 'top issues') "
            "or general campaign strategy. Be specific for better results.")

# -------------------------
# Chat endpoint
# -------------------------
@app.route("/chat", methods=["POST"])
def enhanced_chat():
    user_input = request.json.get("message", "").strip()
    if not user_input:
        return jsonify({"reply": "Please type a question."})

    intent = classify_intent(user_input)
    try:
        if intent == "gender_female":
            reply = gender_insight("Female")
        elif intent == "gender_male":
            reply = gender_insight("Male")
        elif intent == "issues":
            reply = top_issue_insight()
        elif intent == "age":
            reply = age_group_insight()
        elif intent == "booth":
            booth_no = detect_booth_number(user_input)
            reply = booth_supporter_insight(booth_no)
        elif intent == "swing":
            reply = swing_voter_insight()
        elif intent == "win_probability":
            reply = win_probability()
        else:
            reply = llm_response(user_input)
    except Exception as e:
        print("Error generating reply:", e)
        reply = "Internal error — please try again."

    return jsonify({"reply": reply})
       



# ===============================================================
# Serve CSVs that frontend fetches (so JS can call 'ImpFiles/...')
# ===============================================================
@app.route("/ImpFiles/<path:filename>")
def impfiles(filename):
    """
    Serve files placed in static/ImpFiles/ at URL /ImpFiles/<filename>
    This keeps the frontend fetch('ImpFiles/Pandharpur_final.csv') working
    without modifying client code.
    """
    imp_dir = os.path.join(app.static_folder, "ImpFiles")
    if not os.path.isdir(imp_dir):
        # defensive: if folder missing, return 404
        return jsonify({"error": "ImpFiles directory not found on server."}), 404
    return send_from_directory(imp_dir, filename)


# ========================================
# API Endpoints - Worker Module
# ========================================

# --- Voters with filters + pagination ---
@app.route("/api/voters")
def api_voters():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    gender = request.args.get("gender", type=str)
    search = request.args.get("search", type=str)
    
    # Candidate-specific filters
    affiliation = request.args.get("affiliation", type=str)
    age = request.args.get("age", type=str)
    issues = request.args.get("issues", type=str)
    occupation = request.args.get("occupation", type=str)

    query = Voter.query

    # Gender filter
    if gender:
        g = gender.strip().lower()
        if g and g != "all":
            query = query.filter(Voter.gender.ilike(gender))

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Voter.name.ilike(search_term)) |
            (Voter.epic_number.ilike(search_term)) |
            (Voter.house_number.ilike(search_term))
        )

    # Candidate filters
    if affiliation:
        query = query.filter(Voter.political_affiliation.ilike(affiliation))
    
    if age:
        if age == "18-25":
            query = query.filter(Voter.age.between(18, 25))
        elif age == "26-40":
            query = query.filter(Voter.age.between(26, 40))
        elif age == "41-60":
            query = query.filter(Voter.age.between(41, 60))
        elif age == "60+":
            query = query.filter(Voter.age >= 60)
    
    if issues:
        query = query.filter(Voter.key_issues.ilike(f"%{issues}%"))
    
    if occupation:
        query = query.filter(Voter.occupation.ilike(f"%{occupation}%"))

    # Stable ordering
    query = query.order_by(Voter.id.asc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [v.to_dict() for v in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total
    })

# --- Update voter details ---
@app.route("/api/voters/<int:voter_id>", methods=["PUT"])
def update_voter(voter_id):
    voter = Voter.query.get_or_404(voter_id)
    data = request.get_json()

    voter.mobile_number = data.get("mobile_number", voter.mobile_number)
    voter.occupation = data.get("occupation", voter.occupation)
    voter.education_level = data.get("education_level", voter.education_level)
    voter.political_affiliation = data.get("political_affiliation", voter.political_affiliation)
    voter.key_issues = data.get("key_issues", voter.key_issues)
    voter.remarks = data.get("remarks", voter.remarks)

    db.session.commit()
    return jsonify(voter.to_dict())

# --- Household Grouping ---
@app.route("/api/household-data")
def api_household_data():
    from models import VoterLocation
    
    households = {}
    voters = Voter.query.order_by(Voter.id.asc()).all()

    for v in voters:
        loc = VoterLocation.query.filter_by(
            voter_name=v.name,
            voter_house_no=v.house_number
        ).first()

        voter_info = {
            "id": v.id,
            "name": v.name,
            "landmark": loc.landmark if loc else "",
            "latitude": loc.latitude if loc else "",
            "longitude": loc.longitude if loc else "",
        }

        house_key = v.house_number if v.house_number else "No House Number"
        households.setdefault(house_key, []).append(voter_info)

    return jsonify([
        {"house_number": hn, "voters": voters}
        for hn, voters in households.items()
    ])

@app.route("/api/voter-location", methods=["POST"])
def save_voter_location():
    from models import VoterLocation

    data = request.get_json()
    name = data.get("name")
    house = data.get("house_number")

    if not name:
        return jsonify({"error": "Missing name"}), 400

    # ✅ Check if location for same voter already exists
    location = VoterLocation.query.filter_by(
        voter_name=name,
        voter_house_no=house
    ).first()

    if not location:
        location = VoterLocation(voter_name=name, voter_house_no=house)
        db.session.add(location)

    location.landmark = data.get("landmark")
    location.latitude = data.get("latitude")
    location.longitude = data.get("longitude")
    location.saved_at = datetime.utcnow()

    db.session.commit()
    return jsonify({"message": "saved", "location": {
        "landmark": location.landmark,
        "latitude": location.latitude,
        "longitude": location.longitude
    }})

# --- Campaign Tasks CRUD ---
@app.route("/api/tasks", methods=["GET", "POST"])
def api_tasks():
    if request.method == "GET":
        tasks = Task.query.order_by(Task.due_date).all()
        return jsonify([t.to_dict() for t in tasks])

    if request.method == "POST":
        data = request.get_json()
        task = Task(
            title=data.get("title"),
            description=data.get("description"),
            status=data.get("status", "Pending"),
            due_date=datetime.strptime(data["due_date"], "%Y-%m-%d").date() if data.get("due_date") else None
        )
        db.session.add(task)
        db.session.commit()
        return jsonify(task.to_dict()), 201

@app.route("/api/tasks/<int:task_id>", methods=["PUT", "DELETE"])
def api_task_update_delete(task_id):
    task = Task.query.get_or_404(task_id)

    if request.method == "PUT":
        data = request.get_json()
        task.status = data.get("status", task.status)
        task.title = data.get("title", task.title)
        task.description = data.get("description", task.description)
        if data.get("due_date"):
            task.due_date = datetime.strptime(data["due_date"], "%Y-%m-%d").date()
        db.session.commit()
        return jsonify(task.to_dict())

    if request.method == "DELETE":
        db.session.delete(task)
        db.session.commit()
        return jsonify({"message": "Task deleted"})

# --- Communications ---
@app.route("/api/messages", methods=["GET", "POST"])
def api_messages():
    if request.method == "GET":
        messages = Communication.query.order_by(Communication.created_at.desc()).all()
        return jsonify([m.to_dict() for m in messages])

    if request.method == "POST":
        data = request.get_json()
        msg = Communication(
            title=data.get("title"),
            body=data.get("body"),
            audience=data.get("audience")
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify(msg.to_dict()), 201

# --- Reports ---
@app.route("/api/reports", methods=["GET", "POST"])
def api_reports():
    if request.method == "GET":
        reports = Report.query.order_by(Report.submitted_at.desc()).all()
        return jsonify([r.to_dict() for r in reports])

    if request.method == "POST":
        data = request.get_json()
        report = Report(
            title=data.get("title"),
            content=data.get("content"),
            date=datetime.strptime(data["date"], "%Y-%m-%d").date() if data.get("date") else None
        )
        db.session.add(report)
        db.session.commit()
        return jsonify(report.to_dict()), 201

# ========================================
# API Endpoints - Candidate Module
# ========================================

# --- Candidate KPIs for Command Center ---
@app.route("/api/candidate/kpis")
def api_candidate_kpis():
    """Returns KPI data for the candidate command center"""
    # Get voter statistics
    total_voters = Voter.query.count()
    contacted_voters = Voter.query.filter(
        (Voter.mobile_number.isnot(None)) & (Voter.mobile_number != '')
    ).count()
    
    supporters = Voter.query.filter(
        Voter.political_affiliation.ilike('Supporter')
    ).count()
    
    undecided = Voter.query.filter(
        (Voter.political_affiliation.ilike('Neutral')) |
        (Voter.political_affiliation.ilike('SwingVoter')) |
        (Voter.political_affiliation.is_(None))
    ).count()
    
    # Get task statistics
    total_tasks = Task.query.count()
    completed_tasks = Task.query.filter(Task.status.ilike('Completed')).count()
    
    return jsonify({
        "votersContacted": {
            "count": contacted_voters,
            "total": total_voters
        },
        "supporters": supporters,
        "undecided": undecided,
        "tasksCompleted": {
            "count": completed_tasks,
            "total": total_tasks
        }
    })

# --- Candidate specific voter endpoint with filters ---
@app.route("/api/candidate/voters")
def api_candidate_voters():
    """Filtered voter list specifically for candidate analytics"""
    return api_voters()  # Reuse the existing voters endpoint with filters


# --- Visualization API (supports optional same filters) ---
@app.route("/api/candidate/visualization")
def api_candidate_visualization():
    """
    Returns aggregated counts for affiliation, age groups, top issues and gender split.
    Accepts the same query parameters as /api/voters to return filtered aggregates.
    """
    try:
        # Accept optional filters (same params as /api/voters)
        gender = request.args.get("gender", type=str)
        affiliation = request.args.get("affiliation", type=str)
        age = request.args.get("age", type=str)
        issues = request.args.get("issues", type=str)
        occupation = request.args.get("occupation", type=str)
        ward = request.args.get("ward", type=str)
        education = request.args.get("education", type=str)

        query = Voter.query

        if gender:
            g = gender.strip()
            if g and g.lower() != "all":
                query = query.filter(Voter.gender.ilike(g))

        if affiliation:
            if affiliation.lower() == 'empty':
                 query = query.filter(or_(Voter.political_affiliation == None, Voter.political_affiliation == ''))
            elif affiliation.lower() == 'swingvoter':
                query = query.filter(or_(Voter.political_affiliation.ilike('SwingVoter'), Voter.political_affiliation.ilike('Neutral')))
            else:
                query = query.filter(Voter.political_affiliation.ilike(affiliation))

        if age:
            if age == "18-25":
                query = query.filter(Voter.age.between(18, 25))
            elif age == "26-40":
                query = query.filter(Voter.age.between(26, 40))
            elif age == "41-60":
                query = query.filter(Voter.age.between(41, 60))
            elif age == "60+":
                query = query.filter(Voter.age >= 60)

        if issues:
            query = query.filter(Voter.key_issues.ilike(f"%{issues}%"))

        if occupation:
            query = query.filter(Voter.occupation.ilike(f"%{occupation}%"))

        if ward:
            try:
                query = query.filter(Voter.booth_id == int(ward))
            except Exception:
                query = query.filter(Voter.booth_id == ward)

        if education:
            query = query.filter(Voter.education_level.ilike(f"%{education}%"))

        voters = query.all()

        affiliations = Counter()
        age_groups = {"18-25": 0, "26-40": 0, "41-60": 0, "60+": 0}
        issue_counts = Counter()
        gender_split = Counter()

        for v in voters:
            # Normalize affiliation: group 'Neutral' and 'SwingVoter' into 'SwingVoter'
            raw = (v.political_affiliation or "").strip()
            if raw == "":
                affiliations["Empty"] += 1
            else:
                normalized = raw.capitalize()
                if normalized.lower() in ("neutral", "swingvoter"):
                    affiliations["SwingVoter"] += 1
                else:
                    affiliations[normalized] += 1

            # Age groups
            if v.age:
                if v.age <= 25:
                    age_groups["18-25"] += 1
                elif v.age <= 40:
                    age_groups["26-40"] += 1
                elif v.age <= 60:
                    age_groups["41-60"] += 1
                else:
                    age_groups["60+"] += 1

            # Issues
            if v.key_issues:
                for issue in [i.strip().lower() for i in v.key_issues.split(",") if i.strip()]:
                    issue_counts[issue] += 1

            # Gender split
            gender_split[(v.gender or "Other").capitalize()] += 1

        top_issues = dict(issue_counts.most_common(10))

        return jsonify({
            "affiliations": dict(affiliations),
            "ageGroups": age_groups,
            "topIssues": top_issues,
            "genderSplit": dict(gender_split)
        })

    except Exception as e:
        print("Visualization Error:", e)
        return jsonify({"error": "Failed to compute visualization data"}), 500
# --- Booth Management ---
@app.route("/api/booths", methods=["GET", "POST"])
def api_booths():
    if request.method == "GET":
        booths = Booth.query.all()
        booth_data = []
        
        for booth in booths:
            # Calculate voter statistics for each booth
            booth_voters = Voter.query.filter_by(booth_id=booth.id).all()
            total_voters = len(booth_voters)
            supporters = len([v for v in booth_voters if v.political_affiliation and v.political_affiliation.lower() == 'supporter'])
            opponents = len([v for v in booth_voters if v.political_affiliation and v.political_affiliation.lower() == 'opponent'])
            neutral = total_voters - supporters - opponents
            
            booth_dict = booth.to_dict()
            booth_dict.update({
                "total_voters": total_voters,
                "supporters": supporters,
                "opponents": opponents,
                "neutral": neutral
            })
            booth_data.append(booth_dict)
        
        return jsonify(booth_data)

    if request.method == "POST":
        data = request.get_json()
        
        # Check if booth number already exists
        existing_booth = Booth.query.filter_by(booth_number=data.get("booth_number")).first()
        if existing_booth:
            return jsonify({"error": "Booth number already exists"}), 400
        
        booth = Booth(
            name=data.get("name"),
            booth_number=data.get("booth_number"),
            in_charge_name=data.get("in_charge_name"),
            in_charge_contact=data.get("in_charge_contact")
        )
        db.session.add(booth)
        db.session.commit()
        return jsonify(booth.to_dict()), 201

@app.route("/api/booths/<int:booth_id>", methods=["PUT", "DELETE"])
def api_booth_update_delete(booth_id):
    booth = Booth.query.get_or_404(booth_id)

    if request.method == "PUT":
        data = request.get_json()
        
        # Check if booth number is being changed and if it conflicts
        if data.get("booth_number") != booth.booth_number:
            existing_booth = Booth.query.filter_by(booth_number=data.get("booth_number")).first()
            if existing_booth:
                return jsonify({"error": "Booth number already exists"}), 400
        
        booth.name = data.get("name", booth.name)
        booth.booth_number = data.get("booth_number", booth.booth_number)
        booth.in_charge_name = data.get("in_charge_name", booth.in_charge_name)
        booth.in_charge_contact = data.get("in_charge_contact", booth.in_charge_contact)
        
        db.session.commit()
        return jsonify(booth.to_dict())

    if request.method == "DELETE":
        db.session.delete(booth)
        db.session.commit()
        return jsonify({"message": "Booth deleted successfully"})

# --- Segment Management ---
@app.route("/api/segments", methods=["GET", "POST"])
def api_segments():
    if request.method == "GET":
        segments = Segment.query.order_by(Segment.created_at.desc()).all()
        return jsonify([s.to_dict() for s in segments])

    if request.method == "POST":
        data = request.get_json()
        
        # Check if segment name already exists
        existing_segment = Segment.query.filter_by(name=data.get("name")).first()
        if existing_segment:
            return jsonify({"error": "Segment name already exists"}), 400
        
        segment = Segment(
            name=data.get("name"),
            filters=data.get("filters", {})
        )
        db.session.add(segment)
        db.session.commit()
        return jsonify(segment.to_dict()), 201

@app.route("/api/segments/<int:segment_id>", methods=["DELETE"])
def api_segment_delete(segment_id):
    segment = Segment.query.get_or_404(segment_id)
    db.session.delete(segment)
    db.session.commit()
    return jsonify({"message": "Segment deleted successfully"})

# --- Activity Feed for Command Center ---
from datetime import datetime, timezone

@app.route("/api/candidate/activity-feed")
def api_activity_feed():
    """Returns recent activities for the command center (safe timestamp handling)"""
    activities = []

    # Recent tasks
    recent_tasks = Task.query.order_by(Task.created_at.desc()).limit(5).all()
    for task in recent_tasks:
        ts = task.created_at
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        activities.append({
            "type": "task",
            "message": f"Task '{task.title}' - {task.status}",
            "timestamp": ts
        })

    # Recent communications
    recent_comms = Communication.query.order_by(Communication.created_at.desc()).limit(3).all()
    for comm in recent_comms:
        ts = comm.created_at
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        activities.append({
            "type": "communication",
            "message": f"Message sent to {comm.audience}: '{comm.title}'",
            "timestamp": ts
        })

    # Normalize timestamps for sorting
    for act in activities:
        ts = act.get("timestamp")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                pass
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        act["timestamp"] = ts

    # Safe sort
    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    # Convert timestamps back to ISO strings for JSON response
    for act in activities:
        if isinstance(act["timestamp"], datetime):
            act["timestamp"] = act["timestamp"].isoformat()

    return jsonify(activities[:10])


# ========================================
# Candidate Module - Election News Feed
# ========================================
import feedparser

@app.route("/api/candidate/news")
def api_candidate_news():
    """Fetch latest election-related news links from multiple RSS sources."""
    feeds = [
        "https://www.livemint.com/rss/elections",
        "https://indianexpress.com/section/political-pulse/feed/",
        "https://timesofindia.indiatimes.com/rssfeeds/66949542.cms",  # TOI Elections
    ]

    all_news = []
    for rss_url in feeds:
        try:
            feed = feedparser.parse(rss_url)
            for entry in feed.entries[:5]:
                all_news.append({
                    "title": entry.get("title"),
                    "url": entry.get("link"),
                    "source": feed.feed.get("title", "Unknown Source"),
                    "publishedAt": entry.get("published", "")
                })
        except Exception as e:
            print(f"Error fetching {rss_url}: {e}")

    # Sort all news by published date (descending)
    all_news = sorted(all_news, key=lambda x: x["publishedAt"], reverse=True)
    return jsonify(all_news[:15])  # Return top 15 combined items
# ========================================
# Cohere summarizes top voter issues
# ========================================
@app.route("/api/candidate/insights", methods=["GET"])
def api_candidate_insights():
    key_issue_counts = (
        db.session.query(Voter.key_issues, func.count(Voter.key_issues))
        .group_by(Voter.key_issues)
        .order_by(func.count(Voter.key_issues).desc())
        .limit(10)
        .all()
    )

    issues_text = ", ".join(
        f"{issue}: {count} voters"
        for issue, count in key_issue_counts if issue
    )

    if not issues_text:
        return jsonify({"summary": "No issue data found"}), 200

    response = cohere_client.generate(
        model="command-xlarge-nightly",
        prompt=f"Summarize voter concerns: {issues_text}",
        max_tokens=120,
        temperature=0.4
    )

    return jsonify({
        "insights_summary": response.generations[0].text.strip()
    })

# ========================================
# Run
# ========================================
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)