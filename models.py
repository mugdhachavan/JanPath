from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Float
from datetime import datetime
db = SQLAlchemy()

# ------------------------
# Voter Table
# ------------------------
class Voter(db.Model):
    __tablename__ = 'voter_list'

    id = db.Column('ID', db.Integer, primary_key=True)
    name = db.Column('Name', db.String(255), nullable=False)
    father_or_husband_name = db.Column("Father's or Husband's name", db.String(255))
    age = db.Column('Age', db.Integer)
    gender = db.Column('Gender', db.String(20))
    house_number = db.Column('House number', db.String(50))
    epic_number = db.Column('EPIC number', db.String(30))
    mobile_number = db.Column('Mobile Number', db.String(20))
    occupation = db.Column('Occupation', db.String(100))
    education_level = db.Column('Education Level', db.String(50))
    political_affiliation = db.Column('Political Affiliation', db.String(50))
    key_issues = db.Column('Key Issues', db.Text)
    remarks = db.Column('Remarks', db.Text)
    has_voted = db.Column(db.Boolean, default=False)

    booth_id = db.Column(db.Integer, db.ForeignKey('booths.id'))

    def to_dict(self):
        return {
            "ID": self.id,
            "Name": self.name,
            "Father's or Husband's name": self.father_or_husband_name,
            "Age": self.age,
            "Gender": self.gender,
            "House number": self.house_number,
            "EPIC number": self.epic_number,
            "Mobile Number": self.mobile_number,
            "Occupation": self.occupation,
            "Education Level": self.education_level,
            "Political Affiliation": self.political_affiliation,
            "Key Issues": self.key_issues,
            "Remarks": self.remarks,
            "has_voted": self.has_voted,
            "booth_id": self.booth_id,
        }


# ------------------------
# Worker Module: Tasks
# ------------------------
class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), default="Pending")
    due_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ------------------------
# Worker Module: Messages / Communication
# ------------------------
class Communication(db.Model):
    __tablename__ = 'communications'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text)
    audience = db.Column(db.String(255))   # e.g. "All", "Booth-12", "Youth", etc.
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "body": self.body,
            "audience": self.audience,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ------------------------
# Worker Module: Reports
# ------------------------
class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text)
    date = db.Column(db.Date)  # logical "date of report"
    submitted_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "date": self.date.isoformat() if self.date else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
        }


# ------------------------
# Candidate Module: Segments
# ------------------------
class Segment(db.Model):
    __tablename__ = 'segments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    filters = db.Column(JSONB, nullable=False)  # stores voter filters (age, caste, gender etc.)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "filters": self.filters,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ------------------------
# Candidate & Worker Shared: Booths
# ------------------------
class Booth(db.Model):
    __tablename__ = 'booths'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    booth_number = db.Column(db.String(50), unique=True)
    in_charge_name = db.Column(db.String(255))
    in_charge_contact = db.Column(db.String(20))

    voters = db.relationship('Voter', backref='booth', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "booth_number": self.booth_number,
            "in_charge_name": self.in_charge_name,
            "in_charge_contact": self.in_charge_contact,
        }



class VoterLocation(db.Model):
    __tablename__ = 'voter_locations'

    id = db.Column(db.Integer, primary_key=True)
    voter_name = db.Column(db.String(120))
    voter_house_no = db.Column(db.String(50))
    landmark = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    saved_at = db.Column(db.DateTime, default=datetime.utcnow)
