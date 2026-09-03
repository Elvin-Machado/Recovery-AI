import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, average_precision_score, precision_score, recall_score, f1_score, brier_score_loss, accuracy_score
import joblib
import json

# =====================================================================
# SYNTHETIC DATASET GENERATION
# =====================================================================
np.random.seed(42)
N = 30000

amount = np.random.lognormal(mean=7, sigma=1, size=N).round(2)
attempt_count = np.random.randint(1, 6, N)
previous_successful_payments = np.random.randint(0, 50, N)
days_since_last_payment = np.random.randint(1, 365, N)

possible_failure_codes = ['insufficient_funds', 'temporary_decline', 'timeout', 'card_expired', 'account_closed', 'None']
failure_probabilities = [0.35, 0.25, 0.1, 0.1, 0.1, 0.1]
failure_code = np.random.choice(possible_failure_codes, size=N, p=failure_probabilities)
# Set 'None' string to actual None/np.nan to test robustness
failure_code = np.where(failure_code == 'None', None, failure_code)

mandate_status = np.random.choice(['active', 'inactive', 'revoked', 'none'], size=N, p=[0.6, 0.1, 0.1, 0.2])

# Base log-odds
z = -1.5 
z += (previous_successful_payments * 0.05)
z -= (attempt_count * 0.5)

# Failure code map
fc_map = {'insufficient_funds': 0.5, 'temporary_decline': 0.8, 'timeout': 0.3, 'card_expired': -2.5, 'account_closed': -3.5, None: 0.0}
z += np.array([fc_map[fc] for fc in failure_code])

# Mandate map
mandate_map = {'active': 1.0, 'inactive': -0.5, 'revoked': -2.0, 'none': 0.0}
z += np.array([mandate_map[ms] for ms in mandate_status])

z -= (amount / 5000) * 0.2 

recovery_prob = 1 / (1 + np.exp(-z))
recovery_prob = np.clip(recovery_prob + np.random.normal(0, 0.1, N), 0, 1)

recovered = np.random.binomial(1, recovery_prob)

df = pd.DataFrame({
    'amount': amount,
    'attempt_count': attempt_count,
    'previous_successful_payments': previous_successful_payments,
    'days_since_last_payment': days_since_last_payment,
    'failure_code': failure_code,
    'mandate_status': mandate_status,
    'recovered': recovered
})
# Replace None in pandas properly for sklearn
df.fillna('missing', inplace=True)

df.to_csv("recovery_dataset.csv", index=False)

# =====================================================================
# TRAIN & EVALUATE
# =====================================================================
X = df.drop(columns=['recovered'])
y = df['recovered']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

# ----------------- BASELINE (LogReg, 5 features) -----------------
baseline_features = ['amount', 'attempt_count', 'previous_successful_payments', 'days_since_last_payment', 'failure_code']
X_train_base = X_train[baseline_features]
X_test_base = X_test[baseline_features]

base_numeric = ['amount', 'attempt_count', 'previous_successful_payments', 'days_since_last_payment']
base_categorical = ['failure_code']

base_preprocessor = ColumnTransformer([
    ('num', StandardScaler(), base_numeric),
    ('cat', OneHotEncoder(handle_unknown='ignore'), base_categorical)
])

base_model = Pipeline([
    ('preprocessor', base_preprocessor),
    ('classifier', LogisticRegression(max_iter=1000, random_state=42))
])

base_model.fit(X_train_base, y_train)
y_prob_base = base_model.predict_proba(X_test_base)[:, 1]

# ----------------- IMPROVED (Random Forest, 6 features) -----------------
improved_features = ['amount', 'attempt_count', 'previous_successful_payments', 'days_since_last_payment', 'failure_code', 'mandate_status']
X_train_imp = X_train[improved_features]
X_test_imp = X_test[improved_features]

imp_numeric = ['amount', 'attempt_count', 'previous_successful_payments', 'days_since_last_payment']
imp_categorical = ['failure_code', 'mandate_status']

imp_preprocessor = ColumnTransformer([
    ('num', StandardScaler(), imp_numeric),
    ('cat', OneHotEncoder(handle_unknown='ignore'), imp_categorical)
])

imp_model = Pipeline([
    ('preprocessor', imp_preprocessor),
    ('classifier', RandomForestClassifier(n_estimators=100, max_depth=8, min_samples_leaf=5, random_state=42, n_jobs=-1))
])

imp_model.fit(X_train_imp, y_train)
y_prob_imp = imp_model.predict_proba(X_test_imp)[:, 1]

def evaluate(y_true, y_prob, threshold=0.30):
    y_pred = (y_prob >= threshold).astype(int)
    return {
        'ROC-AUC': roc_auc_score(y_true, y_prob),
        'PR-AUC': average_precision_score(y_true, y_prob),
        'Brier': brier_score_loss(y_true, y_prob),
        'Accuracy': accuracy_score(y_true, y_pred),
        'Precision': precision_score(y_true, y_pred, zero_division=0),
        'Recall': recall_score(y_true, y_pred, zero_division=0),
        'F1': f1_score(y_true, y_pred, zero_division=0)
    }

print("BASELINE METRICS (LogReg, 5 feat):")
print(evaluate(y_test, y_prob_base, 0.30))

print("\nIMPROVED METRICS (RandomForest, 6 feat):")
print(evaluate(y_test, y_prob_imp, 0.30))

# OPTIMIZE THRESHOLD
best_net_value = -9999999
best_threshold = 0.30
print("\nECONOMIC THRESHOLD ANALYSIS (IMPROVED MODEL)")
for threshold in [0.30, 0.40, 0.50, 0.60, 0.70, 0.80]:
    preds = (y_prob_imp >= threshold).astype(int)
    interventions = np.sum(preds)
    true_recoveries = np.sum((preds == 1) & (y_test == 1))
    recovered_amount = np.sum(X_test_imp.loc[(preds == 1) & (y_test == 1), 'amount'])
    intervention_cost = interventions * 0.50
    net_recovery = recovered_amount - intervention_cost
    
    if net_recovery > best_net_value:
        best_net_value = net_recovery
        best_threshold = threshold

print(f"Optimal Threshold selected: {best_threshold:.2f}")

joblib.dump(imp_model, 'backend/models/recovery_model.joblib')
print("Model saved to backend/models/recovery_model.joblib")
