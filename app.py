import re
import os
import pandas as pd
import requests
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from io import StringIO
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = 'g-tracker-cyber-secret-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'index'

# --- Models ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def extract_sheet_id(url):
    """Extracts the Google Sheet ID from the URL."""
    if not isinstance(url, str):
        return None
    # Pattern looks for /d/ followed by the ID
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)
    return None

def analyze_dataframe(df):
    """Refactored logic to process an already loaded DataFrame."""
    try:
        # Trim whitespace from headers and values
        df.columns = df.columns.astype(str).str.strip()
        df = df.apply(lambda x: x.str.strip() if x.dtype == "object" else x)

        print("DEBUG: Columns found:", df.columns.tolist())

        # Smart Detection for Name Column
        name_col = None
        name_col_idx = -1
        
        # Priority 1: Look for a column with "name" or "student" in the header (case-insensitive)
        for i, col in enumerate(df.columns):
            if "name" in col.lower() or "student" in col.lower():
                name_col = col
                name_col_idx = i
                break
        
        # Priority 2: If no "name", use heuristics (skip Timestamp)
        if name_col is None:
            if "Timestamp" in df.columns[0]:
                 name_col_idx = 1
            else:
                 name_col_idx = 0
            
            if df.shape[1] > name_col_idx:
                name_col = df.columns[name_col_idx]
        
        if name_col is None or df.shape[1] <= name_col_idx + 1:
             return {"error": f"Could not identify a Name column. Found columns: {df.columns.tolist()}"}

        # All other columns are questions/answers (exclude the name column)
        raw_answer_cols = [c for c in df.columns if c != name_col and "Timestamp" not in c and "Score" not in c and "Total" not in c and "Points" not in c]
        
        # Filter out "Ghost Columns" (columns that are completely empty for EVERYONE)
        # This prevents strict checks from failing just because there's an empty "Comments" column
        answer_cols = []
        for col in raw_answer_cols:
             # Check if this column has ANY valid data in the entire sheet
             has_data = df[col].dropna().apply(lambda x: str(x).strip() not in ["", "nan", "None", "NaN"]).any()
             if has_data:
                 answer_cols.append(col)
        
        print(f"DEBUG: Using '{name_col}' as Name Column.")
        print(f"DEBUG: Using {answer_cols} as Answer Columns.")

        responded_list = []
        not_responded_list = []
        debug_rows = []

        for index, row in df.iterrows():
            student_name = str(row[name_col]).strip()
            
            if not student_name or student_name.lower() in ['nan', 'none', '']:
                continue

            row_answers = row[answer_cols]
            has_response = False
            
            valid_answers = [str(x).strip() for x in row_answers if pd.notna(x) and str(x).strip() not in ["", "nan", "None", "NaN"]]
            
            # STRICT CHECK: If any identified answer column is missing, they are marked as missing.
            if len(valid_answers) == len(answer_cols):
                has_response = True

            if has_response:
                responded_list.append(student_name)
            else:
                # Identify missing columns
                missing = [col for col in answer_cols if str(row[col]).strip() in ["", "nan", "None", "NaN"] or pd.isna(row[col])]
                not_responded_list.append({
                    "name": student_name,
                    "missing": missing
                })
            
            if index < 5 or (not has_response and len(debug_rows) < 10):
                missing_debug = []
                if not has_response:
                     missing_debug = [col for col in answer_cols if str(row[col]).strip() in ["", "nan", "None", "NaN"] or pd.isna(row[col])]
                
                debug_rows.append({
                    "name": student_name,
                    "status": "Responded" if has_response else "Not Responded",
                    "answers_found": len(valid_answers),
                    "total_required": len(answer_cols),
                    "missing_cols": missing_debug
                })

        return {
            "total_students": len(responded_list) + len(not_responded_list),
            "responded_count": len(responded_list),
            "not_responded_count": len(not_responded_list),
            "responded_list": responded_list,
            "not_responded_list": not_responded_list,
            "debug_info": {
                "detected_name_column": name_col,
                "detected_answer_columns": answer_cols,
                "preview_rows": debug_rows
            }
        }

    except Exception as e:
        print(f"DEBUG: Error analyzing dataframe: {e}")
        return {"error": str(e)}

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('methods'))
    return render_template('index.html', view='auth')

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "User already exists"}), 400
    
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"success": "Account created successfully"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()
    
    if user and check_password_hash(user.password, password):
        login_user(user)
        return jsonify({"success": "Logged in successfully"})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/methods')
@login_required
def methods():
    return render_template('index.html', view='methods')

@app.route('/tracker')
@login_required
def tracker():
    return render_template('index.html', view='tracker')

@app.route('/check', methods=['POST'])
@login_required
def check_responses():
    print("DEBUG: Received /check request")
    df = None
    
    # Handle File Upload
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        try:
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                df = pd.read_csv(file)
            elif filename.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(file)
            else:
                return jsonify({"error": "Invalid file format. Please upload CSV or Excel."}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to read file: {str(e)}"}), 500

    # Handle URL
    elif request.is_json:
        data = request.json
        sheet_url = data.get('url')
        if not sheet_url:
             return jsonify({"error": "No data provided"}), 400
             
        sheet_id = extract_sheet_id(sheet_url)
        if not sheet_id:
             return jsonify({"error": "Invalid Google Sheet URL"}), 400
             
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
        try:
            df = pd.read_csv(csv_url)
        except Exception as e:
            return jsonify({"error": f"Failed to fetch Google Sheet: {str(e)}"}), 400

    else:
        return jsonify({"error": "Unsupported request type"}), 400

    if df is not None:
        results = analyze_dataframe(df)
        if "error" in results:
             return jsonify(results), 400
        return jsonify(results)
    
@app.route('/export', methods=['POST'])
@login_required
def export_excel():
    try:
        data = request.json
        items = data.get('items', [])
        type_name = data.get('type', 'data')
        
        if not items:
            return jsonify({"error": "No data to export"}), 400

        # Create DataFrame
        export_data = []
        for item in items:
            if isinstance(item, dict):
                export_data.append({
                    "Name": item.get('name', 'Unknown'),
                    "Missing Fields": ", ".join(item.get('missing', []))
                })
            else:
                export_data.append({"Name": item})
        
        export_df = pd.DataFrame(export_data)
        
        # Save to memory
        from io import BytesIO
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            export_df.to_excel(writer, index=False, sheet_name='BlackShip_Extract')
        
        output.seek(0)
        
        from flask import send_file
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"BlackShip_{type_name}_export.xlsx"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
