import re
import requests
from urllib.parse import urljoin

class TurboVideoExtractor:
    def __init__(self, embed_url, phpsessid):
        self.session = requests.Session()
        self.base_url = "https://turbovid.eu/"
        self.embed_url = embed_url
        self.session.cookies.set("PHPSESSID", phpsessid)
        
        # Set headers to match browser behavior
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "Referer": self.embed_url,
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
        }

    def extract_js_vars(self, html):
        """Extract critical variables from embedded script tags"""
        return {
            'media_type': re.search(r'const media_type = "([^"]+)', html).group(1),
            'posterPath': re.search(r'const posterPath = "([^"]+)', html).group(1),
            'apkey': re.search(r'const apkey = "([^"]+)', html).group(1),
            'dakey': re.search(r'const dakey = "([^"]+)', html).group(1),
            'xxid': re.search(r'const xxid\s*=\s*"([^"]+)', html).group(1),
            'xyid': re.search(r'const xyid\s*=\s*"([^"]+)', html).group(1),
        }

    def decrypt_hex_with_key(self, hex_data, key):
        """Replica of TurboCrypto's XOR decryption"""
        binary = bytes.fromhex(hex_data)
        return bytes([b ^ key.encode()[i % len(key)] for i, b in enumerate(binary)]).decode()

    def get_video_source(self):
        try:
            # Step 1: Get embed page and extract variables
            resp = self.session.get(self.embed_url, headers=self.headers)
            js_vars = self.extract_js_vars(resp.text)
            
            # Step 2: Get decryption keys
            juice_url = urljoin(self.base_url, "/api/cucked/juice_key")
            juice_resp = self.session.get(juice_url, headers=self.headers).json()
            
            # Step 3: Get encrypted video data
            juice_v2_url = urljoin(self.base_url, 
                f"/api/cucked/the_juice_v2/?{js_vars['apkey']}={js_vars['xxid']}")
            encrypted_data = self.session.get(juice_v2_url, headers=self.headers).json()["data"]
            
            # Step 4: Decrypt video URL
            video_url = self.decrypt_hex_with_key(
                encrypted_data, 
                juice_resp["juice"]
            )
            
            return {
                "status": "success",
                "video_url": video_url,
                "decryption_key": juice_resp["juice"],
                "metadata": js_vars
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "debug_info": {
                    "embed_url": self.embed_url,
                    "headers": dict(self.headers),
                    "cookies": dict(self.session.cookies)
                }
            }
    # 

# Usage Example:
if __name__ == "__main__":
    EMBED_URL = "https://turbovid.eu/embed/ZhkbFoEBXfJu"
    PHPSESSID = "kotikh1sb38goo9utbftunbs5o"
    print("Extracting video source from:", EMBED_URL)
    
    extractor = TurboVideoExtractor(EMBED_URL, PHPSESSID)
    result = extractor.get_video_source()
    
    if result["status"] == "success":
        print("Decrypted Video URL:", result["video_url"])
    else:
        print("Error:", result["message"])
        print("Debug Info:", result["debug_info"])