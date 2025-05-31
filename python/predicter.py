from flask import Flask, request, jsonify
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score

app = Flask(__name__)

# ---------- Load and Prepare Data ----------
df = pd.read_csv("Student.csv")
df.columns = df.columns.str.strip()  # Remove extra spaces from column names

# Map GPA to numerical values
gpa_map = {
    '4.5 - 5': 4.75,
    '4 - 4.49': 4.25,
    '3.5 - 3.99': 3.75,
    '3 - 3.49': 3.25,
    '2.5 - 2.99': 2.75,
    '2 - 2.49': 2.25,
    '1.5 - 1.99': 1.75,
    '1 - 1.49': 1.25,
    'أقل من 1': 0.75
}
df['GPA'] = df['GPA'].map(gpa_map)

# Map grades to numerical values
grade_map = {
    'A+': 4.0, 'A': 3.75, 'B+': 3.5, 'B': 3.0,
    'C+': 2.5, 'C': 2.0, 'D+': 1.5, 'D': 1.0,
    'F': 0.0, 'F1': 0.0, 'F2': 0.0, 'F3': 0.0
}
subject_columns = ['CS 383', 'CS 214', 'MATH 116', 'CS 222', 'CS 182', 'MATH 115']
for col in subject_columns:
    if col in df.columns:
        df[col] = df[col].map(grade_map)
    else:
        print(f"Warning: Column '{col}' not found in the dataset.")

# Convert 'Sem Hours' to numeric
df['Sem Hours'] = pd.to_numeric(df['Sem Hours'], errors='coerce')

# Rename columns for easier handling
df.rename(columns={
    'CS 383': 'CS383', 'CS 214': 'CS214', 'MATH 116': 'MATH116',
    'CS 222': 'CS222', 'CS 182': 'CS182', 'MATH 115': 'MATH115',
    'Sem Hours': 'semester_hours'
}, inplace=True)

# ---------- Prepare Models ----------
subject_feature_priority = {
    'CS383': ['CS222', 'CS182', 'MATH115'],
    'CS214': ['CS182', 'CS222', 'MATH115'],
    'MATH116': ['MATH115', 'CS222', 'CS182']
}

models = {}
imputers = {}
features_dict = {}

for subject in subject_feature_priority:
    features = subject_feature_priority[subject] + ['GPA', 'semester_hours']
    X = df[features]
    y = df[subject]
    imp = SimpleImputer(strategy='mean')
    X_imputed = imp.fit_transform(X)
    model = LinearRegression().fit(X_imputed, y)
    models[subject] = model
    imputers[subject] = imp
    features_dict[subject] = features

# ---------- Prediction Function ----------
def predict_grade(subject_name: str, input_data: dict):
    if subject_name not in models:
        raise ValueError("❌ Cannot predict for this subject.")
    
    model = models[subject_name]
    imputer = imputers[subject_name]
    features = features_dict[subject_name]

    input_df = pd.DataFrame([input_data], columns=features)
    input_filled = imputer.transform(input_df)
    prediction = model.predict(input_filled)[0]
    return round(float(prediction), 2)

# ---------- Model Accuracy ----------
def model_accuracies():
    accuracy_scores = {}
    for subject in subject_feature_priority:
        features = features_dict[subject]
        X = df[features]
        y_true = df[subject]
        y_pred = models[subject].predict(imputers[subject].transform(X))
        r2 = r2_score(y_true, y_pred)
        accuracy_scores[subject] = round(r2 * 100, 2)
    return accuracy_scores

# ---------- Flask API Routes ----------
@app.route('/predict', methods=['POST'])
def predict_api():
    """
    Flask API endpoint for predicting grades.
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400

        subject = data.get('subject')
        if not subject:
            return jsonify({'error': 'No subject provided'}), 400

        input_data = {key: data[key] for key in data if key != 'subject'}
        prediction = predict_grade(subject, input_data)
        prediction_Leter = None
        if prediction >= 4.5:
            prediction_Leter = 'A+'
        elif prediction >= 4:
            prediction_Leter = 'A'
        elif prediction >= 3.5:
            prediction_Leter = 'B+'
        elif prediction >= 3:
            prediction_Leter = 'B'
        elif prediction >= 2.5:
            prediction_Leter = 'C+'
        elif prediction >= 2:
            prediction_Leter = 'C'
        elif prediction >= 1.5:
            prediction_Leter = 'D+'
        elif prediction >= 1:
            prediction_Leter = 'D'
        else:
            prediction_Leter = 'F'

        return jsonify({'prediction': prediction, 'letter_grade': prediction_Leter}), 200
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/', methods=['GET'])
def home():
    try:
        return jsonify({'message': "🎓 Student Grade Prediction API is running!"}), 200
    except Exception as e:
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500

# ---------- Run Server ----------
if __name__ == "__main__":
    app.run(port=5001, debug=True, use_reloader=True)