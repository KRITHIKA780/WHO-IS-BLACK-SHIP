import re
import pandas as pd
import requests
import io
import json
import os
import secrets
from io import StringIO
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, render_template, request, jsonify, send_file, session

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
USER_DB = "users.json"

def load_users():
    if not os.path.exists(USER_DB):
        return {}
    with open(USER_DB, "r") as f:
        return json.load(f)

def save_users(users):
    with open(USER_DB, "w") as f:
        json.dump(users, f, indent=4)

def extract_sheet_id(url):
    """Extracts the Google Sheet ID from the URL."""
    if not isinstance(url, str):
        return None
    # Pattern looks for /d/ followed by the ID
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)
    return None

def analyze_dataframe(df, master_list=[]):
    """Refactored logic to process an already loaded DataFrame + Master List."""
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
        not_responded_list = [] # This is actually "Incomplete" now
        debug_rows = []
        
        # Track all names found in the sheet
        names_in_sheet = set()

        for index, row in df.iterrows():
            student_name = str(row[name_col]).strip()
            
            if not student_name or student_name.lower() in ['nan', 'none', '']:
                continue
                
            names_in_sheet.add(student_name.lower()) # For master comparison

            row_answers = row[answer_cols]
            has_response = False
            
            valid_answers = [str(x).strip() for x in row_answers if pd.notna(x) and str(x).strip() not in ["", "nan", "None", "NaN"]]
            
            # STRICT CHECK: Must fill ALL answer columns
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
        
        # --- Master List Logic ---
        missing_from_master = []
        if master_list and len(master_list) > 0:
            for name in master_list:
                clean_name = str(name).strip()
                if clean_name.lower() not in names_in_sheet:
                    missing_from_master.append(clean_name)

        return {
            "total_students": len(master_list) if master_list else (len(responded_list) + len(not_responded_list)),
            "responded_count": len(responded_list),
            "not_responded_count": len(not_responded_list),
            "responded_list": responded_list,
            "not_responded_list": not_responded_list,
            "missing_from_master": missing_from_master,
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
    return render_template('index.html')

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    users = load_users()
    if username in users:
        return jsonify({"error": "Username already exists"}), 400

    users[username] = {
        "email": email,
        "password": generate_password_hash(password)
    }
    save_users(users)
    
    return jsonify({"success": True, "username": username})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    users = load_users()
    user = users.get(username)

    if user and check_password_hash(user['password'], password):
        session['user'] = username
        return jsonify({"success": True, "username": username})
    
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({"success": True})

@app.route('/session', methods=['GET'])
def get_session():
    if 'user' in session:
        return jsonify({"logged_in": True, "username": session['user']})
    return jsonify({"logged_in": False})

@app.route('/check', methods=['POST'])
def check_responses():
    if 'user' not in session:
        return jsonify({"error": "Authentication required"}), 401
    
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
        master_list = data.get('master_list', []) # Get master list from JSON
        
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
        # If master list was passed in form data (File Mode), it needs to be parsed
        if 'master_list' in request.form:
            try:
                import json
                master_list = json.loads(request.form['master_list'])
            except:
                master_list = []

        results = analyze_dataframe(df, master_list)
        if "error" in results:
             return jsonify(results), 400
        return jsonify(results)
    
    return jsonify({"error": "Processing failed"}), 500

@app.route('/export', methods=['POST'])
def export_results():
    if 'user' not in session:
        return jsonify({"error": "Authentication required"}), 401
        
    df = None
    master_list = []
    
    # --- Duplicate Logic for Data Loading (Similar to /check) ---
    # In a production app, we'd refactor this into a helper function `get_df_from_request`
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        try:
            if 'master_list' in request.form:
                import json
                master_list = json.loads(request.form['master_list'])

            filename = file.filename.lower()
            if filename.endswith('.csv'):
                df = pd.read_csv(file)
            elif filename.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(file)
            else:
                return jsonify({"error": "Invalid file format."}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to read file: {str(e)}"}), 500

    elif request.is_json:
        data = request.json
        sheet_url = data.get('url')
        master_list = data.get('master_list', [])
        
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
        results = analyze_dataframe(df, master_list)
        if "error" in results:
             return jsonify(results), 400
        
        # --- Generate Excel ---
        try:
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                # Summary Sheet
                summary_data = {
                    'Metric': ['Total Students', 'Responded', 'Incomplete', 'Missing from Master List'],
                    'Count': [
                        results['total_students'], 
                        results['responded_count'], 
                        results['not_responded_count'],
                        len(results.get('missing_from_master', []))
                    ]
                }
                pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)
                
                # Responded Sheet
                if results['responded_list']:
                    pd.DataFrame({'Name': results['responded_list']}).to_excel(writer, sheet_name='Responded', index=False)
                
                # Incomplete Sheet
                if results['not_responded_list']:
                    # Expand the list of objects to a nice dataframe
                    incomplete_data = []
                    for item in results['not_responded_list']:
                        incomplete_data.append({
                            'Name': item['name'],
                            'Missing Fields': ", ".join(item['missing'])
                        })
                    pd.DataFrame(incomplete_data).to_excel(writer, sheet_name='Incomplete', index=False)
                
                # Missing Master List Sheet
                if results.get('missing_from_master'):
                    pd.DataFrame({'Name': results['missing_from_master']}).to_excel(writer, sheet_name='Missing', index=False)
                
            output.seek(0)
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name='g_tracker_report.xlsx'
            )

        except Exception as e:
            return jsonify({"error": f"Failed to generate Excel: {str(e)}"}), 500

    return jsonify({"error": "Processing failed"}), 500

if __name__ == '__main__':
    app.run(debug=True)
