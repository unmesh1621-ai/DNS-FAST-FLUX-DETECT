from Rx.rule import Rule
import json
from dnsquery.domain_features import get_domain_features
from tinylogging import new_event, decorated_println
from pathlib import Path

script_path = Path(__file__).resolve()
config_dir = script_path.parent.parent / "config"
rules_path = config_dir / "rules.json"
dns_conf_path = config_dir / "dns_config.json"
classification_path = config_dir / "classification.json"

print(dns_conf_path)

def load_config():
    rules = []
    new_event("Loading rules.json", "cyan")

    with open(rules_path) as f:
        data = json.load(f)

    for r in data["rules"]:
        rule = Rule(
            name=r["name"],
            thresholds=r.get("thresholds"),
            weights=r.get("weights"),
            invert=r.get("invert", False)
        )
        rules.append(rule)

    new_event("Finished loading rules.json\n", "green")

    new_event("Loading classification.json", "cyan")
    with open(classification_path) as f:
        confidence_thresh = json.load(f)["confidence"]
    new_event("Finished loading classification.json\n", "green")

    new_event("Loading dns_config.json", "cyan")
    with open(dns_conf_path) as f:
        dns_conf = json.load(f)
        dns_server = dns_conf["dns_server"]
        timeout = dns_conf["timeout"]
    new_event("Finished loading dns_config.json\n", "green")

    return rules, confidence_thresh, dns_server, timeout


def get_score(domain: str):
    rules, conf_thresh, dns_server, timeout = load_config()
    max_score = 0
    total_score = 0
    features = get_domain_features(domain, dns_server, timeout)
    features = {k: (0 if v is None else v) for k, v in features.items()}

    idx = 0

    new_event("Detecting Fast Flux using R1", "yellow")
    for feature in features:
        score, _ = rules[idx].evaluate(features[feature])
        total_score += score
        max_score += rules[idx].get_max_weight()
        idx += 1

    scaled_score = (total_score / max_score) * 100 if max_score else 0 # safeguard against ZeroDivisionError
    print("="*115, end="")
    print(f"\nTotal R1 score: {total_score}/{max_score} | Scaled: {scaled_score:.2f}/100")
    eval_score(scaled_score, conf_thresh)
    print("=" *115, end="\n")


def eval_score(score: int|float, conf_t: dict):
    if score >= conf_t["high"]:
        decorated_println(f"Score: {score:.2f} → High Confidence: This domain is likely using fast-flux techniques.", "red")
    elif score >= conf_t["medium"]:
        decorated_println(f"Score: {score:.2f} → Medium Confidence: This domain may be using fast-flux techniques. Further investigation recommended.", "yellow")
    else:
        decorated_println(f"Score: {score:.2f} → Low Confidence: This domain is unlikely to be fast-flux.", "green")


