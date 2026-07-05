import joblib
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

try:
    scaler = joblib.load(BASE_DIR / "scaler.pkl")
    rf_model = joblib.load(BASE_DIR / "rf_model.pkl")
    gb_model = joblib.load(BASE_DIR / "gb_model.pkl")
    MODELS_AVAILABLE = True
except FileNotFoundError:
    scaler = None
    rf_model = None
    gb_model = None
    MODELS_AVAILABLE = False


def predict(ip_count: float,
                 ttl_median: float,
                 asn_count: float,
                 country_count: float,
                 domain_age_days: float) -> dict:
    """
    Predict using both Random Forest and Gradient Boosting.

    Args:
        ip_count, ttl_median, asn_count, country_count, domain_age_days: feature values

    Returns:
        dict: {'rf': np.int64(), 'gb': np.int64()}
        0 -> benign
        1 -> malicious

        rf - Random Forest
        gb - Gradient Boosting
    """
    if not MODELS_AVAILABLE:
        raise RuntimeError(
            "ML models are not trained yet. Run CoreML/train.py to generate "
            "scaler.pkl, rf_model.pkl and gb_model.pkl."
        )

    X_new = [[ip_count, ttl_median, asn_count, country_count, domain_age_days]]

    X_scaled = scaler.transform(X_new)

    rf_pred = rf_model.predict(X_scaled)[0]
    gb_pred = gb_model.predict(X_scaled)[0]

    return {"rf": rf_pred, "gb": gb_pred}

