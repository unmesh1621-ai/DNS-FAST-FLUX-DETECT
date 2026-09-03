from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime
from pathlib import Path
import sys
import json
import io

sys.path.insert(0, str(Path(__file__).parent.parent))

from Rx.core import get_score, load_config
from dnsquery.domain_features import get_domain_features
from tinylogging import new_event
from CoreML.predict import predict as ml_predict, MODELS_AVAILABLE as ML_MODELS_AVAILABLE

app = Flask(__name__)
CORS(app)

ANALYSIS_HISTORY = []
LOG_BUFFER = []

class LogCapture:
    def __init__(self):
        self.logs = []
    
    def write(self, message):
        if message.strip():
            self.logs.append({
                'timestamp': datetime.now().isoformat(),
                'message': message.strip()
            })
            LOG_BUFFER.append(message.strip())
    
    def flush(self):
        pass

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'ml_models_available': ML_MODELS_AVAILABLE
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_domain():
    global LOG_BUFFER
    LOG_BUFFER = []
    
    try:
        data = request.json
        domain = data.get('domain', '').strip()
        
        if not domain:
            return jsonify({'error': 'Domain is required'}), 400
        
        new_event(f"Starting analysis for {domain}", "cyan")
        
        rules, conf_thresh, dns_server, timeout = load_config()
        
        try:
            features = get_domain_features(domain, dns_server, timeout)
        except Exception as e:
            new_event(f"Feature extraction warning: {str(e)}", "yellow")
            features = {
                'ip_count': 0,
                'median_ttl': None,
                'ttl_var': 0,
                'asn_diversity': 0,
                'geo_diversity': 0,
                'domain_age': None,
                'mannheim_rule': 0
            }
        
        features = {k: (0 if v is None else v) for k, v in features.items()}
        
        max_score = 0
        total_score = 0
        rule_details = []
        
        for idx, rule in enumerate(rules):
            if idx < len(features):
                feature_keys = list(features.keys())
                feature_value = features[feature_keys[idx]]
                score, tier = rule.evaluate(feature_value)
                max_weight = rule.get_max_weight()
                
                rule_details.append({
                    'name': rule.get_name(),
                    'value': feature_value if isinstance(feature_value, (int, float)) else str(feature_value),
                    'threshold_tier': tier,
                    'score': score,
                    'max_weight': max_weight,
                    'status': 'high_risk' if tier == 'very_high' else 'medium_risk' if tier == 'high' else 'low_risk'
                })
                
                total_score += score
                max_score += max_weight
        
        scaled_score = (total_score / max_score * 100) if max_score > 0 else 0
        
        if scaled_score >= conf_thresh['high']:
            classification = 'Fast-Flux'
            risk_level = 'high'
            color = 'red'
        elif scaled_score >= conf_thresh['medium']:
            classification = 'Suspicious'
            risk_level = 'medium'
            color = 'orange'
        else:
            classification = 'Benign'
            risk_level = 'low'
            color = 'green'
        
        analysis_result = {
            'domain': domain,
            'timestamp': datetime.now().isoformat(),
            'final_score': round(scaled_score, 2),
            'classification': classification,
            'risk_level': risk_level,
            'color': color,
            'rule_details': rule_details,
            'logs': LOG_BUFFER
        }
        
        ANALYSIS_HISTORY.append(analysis_result)
        
        return jsonify(analysis_result), 200
    
    except Exception as e:
        return jsonify({'error': str(e), 'logs': LOG_BUFFER}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify({'history': ANALYSIS_HISTORY[-50:]}), 200

@app.route('/api/history/<domain>', methods=['GET'])
def get_domain_history(domain):
    domain_history = [h for h in ANALYSIS_HISTORY if h['domain'].lower() == domain.lower()]
    return jsonify({'history': domain_history}), 200

@app.route('/api/config', methods=['GET'])
def get_config():
    config_dir = Path(__file__).parent.parent / 'config'
    try:
        with open(config_dir / 'rules.json') as f:
            rules_config = json.load(f)
        with open(config_dir / 'classification.json') as f:
            classification_config = json.load(f)
        return jsonify({
            'rules': rules_config,
            'classification': classification_config
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    if not ANALYSIS_HISTORY:
        return jsonify({'error': 'No analysis history'}), 400
    
    csv_data = 'Domain,Final Score,Classification,Risk Level,Timestamp\n'
    for record in ANALYSIS_HISTORY:
        csv_data += f"{record['domain']},{record['final_score']},{record['classification']},{record['risk_level']},{record['timestamp']}\n"
    
    return send_file(
        io.BytesIO(csv_data.encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name='fastflux_analysis.csv'
    )

@app.route('/api/stats', methods=['GET'])
def get_stats():
    if not ANALYSIS_HISTORY:
        return jsonify({'total': 0, 'fast_flux_count': 0, 'suspicious_count': 0, 'benign_count': 0}), 200
    
    fast_flux_count = sum(1 for h in ANALYSIS_HISTORY if h['risk_level'] == 'high')
    suspicious_count = sum(1 for h in ANALYSIS_HISTORY if h['risk_level'] == 'medium')
    benign_count = sum(1 for h in ANALYSIS_HISTORY if h['risk_level'] == 'low')
    
    return jsonify({
        'total': len(ANALYSIS_HISTORY),
        'fast_flux_count': fast_flux_count,
        'suspicious_count': suspicious_count,
        'benign_count': benign_count,
        'avg_score': round(sum(h['final_score'] for h in ANALYSIS_HISTORY) / len(ANALYSIS_HISTORY), 2)
    }), 200

@app.route('/api/predict', methods=['POST'])
def run_prediction():
    data = request.json or {}
    try:
        ip_count = float(data['ip_count'])
        ttl_median = float(data['ttl_median'])
        asn_count = float(data['asn_count'])
        country_count = float(data['country_count'])
        domain_age_days = float(data['domain_age_days'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Invalid input data'}), 400

    try:
        predictions = ml_predict(ip_count, ttl_median, asn_count, country_count, domain_age_days)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({key: int(value) for key, value in predictions.items()}), 200

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, host='0.0.0.0', port=port)
