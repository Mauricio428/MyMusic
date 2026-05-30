from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import re
import tempfile

app = Flask(__name__)
CORS(app)

DOWNLOAD_FOLDER = tempfile.gettempdir()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIES_FILE = os.path.join(BASE_DIR, 'cookies.txt')

def is_valid_youtube_url(url):
    pattern = r'(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]+'
    return re.match(pattern, url) is not None

@app.route('/')
def index():
    return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/styles.css')
def styles():
    return send_file(os.path.join(BASE_DIR, 'styles.css'))

@app.route('/script.js')
def script():
    return send_file(os.path.join(BASE_DIR, 'script.js'))

@app.route('/info', methods=['POST'])
def get_info():
    data = request.get_json()
    url = data.get('url', '').strip()
    if not url or not is_valid_youtube_url(url):
        return jsonify({'error': 'URL inválida'}), 400
    try:
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'cookiefile': COOKIES_FILE if os.path.exists(COOKIES_FILE) else None,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return jsonify({
                'title': info.get('title', 'Sin título'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'uploader': info.get('uploader', ''),
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url', '').strip()
    if not url or not is_valid_youtube_url(url):
        return jsonify({'error': 'URL inválida'}), 400
    try:
        output_template = os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s')
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_template,
            'quiet': True,
            'cookiefile': COOKIES_FILE if os.path.exists(COOKIES_FILE) else None,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'audio')
            filename = ydl.prepare_filename(info)
            mp3_path = os.path.splitext(filename)[0] + '.mp3'
        if os.path.exists(mp3_path):
            return send_file(mp3_path, mimetype='audio/mpeg', as_attachment=True, download_name=f"{title}.mp3")
        else:
            return jsonify({'error': 'No se pudo generar el MP3'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, port=port, host='0.0.0.0')
