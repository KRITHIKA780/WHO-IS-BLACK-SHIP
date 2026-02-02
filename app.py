import re
import pandas as pd
import requests
from flask import Flask, render_template, request, jsonify
from io import StringIO

app = Flask(__name__)

def extract_sheet_id(url):
    """Extracts the Google Sheet ID from the URL."""
    # Pattern looks for /d/ followed by the ID
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)
    return None

def process_sheet_data(csv_url):
    """Reads CSV data and categorizes students."""
    try:
        # Read the CSV from the URL
        df = pd.read_csv(csv_url)
        
        # Trim whitespace from headers and values
        df.columns = df.columns.str.strip()
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
        # We process all columns EXCEPT the name column and Timestamp column (if exists)
        raw_answer_cols = [c for c in df.columns if c != name_col and "Timestamp" not in c]
        
        # Filter out "Ghost Columns" (columns that are completely empty for EVERYONE)
        # This prevents strict checks from failing just because there's an empty "Comments" column or formatting column
        answer_cols = []
        for col in raw_answer_cols:
             # Check if this column has ANY valid data
             has_data = df[col].dropna().apply(lambda x: str(x).strip() not in ["", "nan", "None", "NaN"]).any()
             if has_data:
                 answer_cols.append(col)
        
        print(f"DEBUG: Using '{name_col}' as Name Column.")
        print(f"DEBUG: Using {answer_cols} as Answer Columns (filtered from {len(raw_answer_cols)} total).")

        responded_list = []
        not_responded_list = []
        debug_rows = [] # Store first 5 rows for debugging

        for index, row in df.iterrows():
            student_name = str(row[name_col]).strip()
            
            # Skip empty names or 'nan'
            if not student_name or student_name.lower() in ['nan', 'none', '']:
                continue

            # Check answers
            row_answers = row[answer_cols]
            
            has_response = False
            
            # Efficiently check if any value is not null and not empty string
            valid_answers = [str(x).strip() for x in row_answers if pd.notna(x) and str(x).strip() not in ["", "nan", "None", "NaN"]]
            
            # STRICT CHECK: Must fill ALL answer columns to be considered "Responded"
            if len(valid_answers) == len(answer_cols):
                has_response = True

            if has_response:
                responded_list.append(student_name)
            else:
                not_responded_list.append(student_name)
            
            if index < 5:
                debug_rows.append({
                    "name": student_name,
                    "status": "Responded" if has_response else "Not Responded",
                    "answers_found": len(valid_answers)
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
        print(f"DEBUG: Error processing sheet: {e}")
        return {"error": str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check', methods=['POST'])
def check_responses():
    data = request.json
    sheet_url = data.get('url')

    if not sheet_url:
        return jsonify({"error": "No URL provided"}), 400

    sheet_id = extract_sheet_id(sheet_url)
    if not sheet_id:
        return jsonify({"error": "Invalid Google Sheet URL. Could not find Sheet ID."}), 400

    # Construct CSV Export URL
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    
    # We can try to verify connectivity first, but requests/pandas will handle it
    results = process_sheet_data(csv_url)
    
    if "error" in results:
        status_code = 400 if "must have" in results["error"] else 500
        return jsonify(results), status_code

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
