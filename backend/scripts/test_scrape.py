import requests
import json
import re
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings()

import sys
sys.stdout.reconfigure(encoding='utf-8')

SESSION = requests.Session()
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
}

def test_fetch():
    url = "https://digital.gov.eg/"
    r = SESSION.get(url, headers=HEADERS, verify=False, timeout=10)
    print("Status:", r.status_code)
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # Check Next.js App Router inline data script
    scripts = soup.find_all('script')
    for idx, s in enumerate(scripts):
        if s.string and 'self.__next_f.push' in s.string:
            # Found App Router streamed data
            print(f"Found __next_f script #{idx}, length: {len(s.string)}")
            matches = re.findall(r'[\u0600-\u06FF\s\w\-\/]{3,50}', s.string)
            arabic_texts = [m.strip() for m in matches if any(c >= '\u0600' and c <= '\u06FF' for c in m)]
            print("Sample Arabic terms in stream:", arabic_texts[:20])

    # Inspect all script chunks to gather route paths
    scripts = soup.find_all('script', src=True)
    all_routes = set()
    all_categories = set()
    for s in scripts:
        src = s['src']
        if '_next/static/chunks' in src:
            full_url = "https://digital.gov.eg" + src if src.startswith('/') else src
            res = SESSION.get(full_url, headers=HEADERS, verify=False, timeout=10)
            if res.status_code == 200:
                # Find route paths like /categories/... or /services/...
                paths = re.findall(r'\"(/[a-zA-Z0-9_\-\/]+)\"', res.text)
                for p in paths:
                    if 'categories' in p or 'services' in p or 'sub-category' in p:
                        all_routes.add(p)
                # Find arabic category titles
                ar_matches = re.findall(r'\"([\u0600-\u06FF\s]{4,60})\"', res.text)
                for item in ar_matches:
                    all_categories.add(item.strip())
    
    print("\nDiscovered routes:", sorted(list(all_routes)))
    print("\nDiscovered Arabic categories/services:", sorted(list(all_categories))[:40])

if __name__ == '__main__':
    test_fetch()
