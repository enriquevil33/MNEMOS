from flask import Blueprint, send_file, jsonify, current_app
import os
import json

bp = Blueprint('docs', __name__, url_prefix='/api/docs')

@bp.route('/', methods=['GET'])
def swagger_ui():
    """Serve Swagger UI for interactive API documentation."""
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mnemos API Documentation</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.5/swagger-ui.css">
        <style>
            body {
                margin: 0;
                padding: 0;
            }
        </style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
        <script>
            window.onload = function() {
                window.ui = SwaggerUIBundle({
                    url: '/api/docs/swagger.json',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "StandaloneLayout",
                    defaultModelsExpandDepth: 1,
                    defaultModelExpandDepth: 1,
                    docExpansion: "list",
                    filter: true,
                    showExtensions: true,
                    showCommonExtensions: true
                });
            };
        </script>
    </body>
    </html>
    """
    return html_content, 200, {'Content-Type': 'text/html'}

@bp.route('/swagger.json', methods=['GET'])
def get_swagger_spec():
    """Serve the OpenAPI specification JSON file."""
    # Try multiple possible locations for swagger.json
    possible_paths = [
        # Docker/production: swagger.json in /app directory
        os.path.join('/app', 'swagger.json'),
        # Local development: swagger.json in project root
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'swagger.json'),
        # Fallback: relative to current working directory
        os.path.join(os.getcwd(), 'swagger.json'),
    ]

    swagger_path = None
    for path in possible_paths:
        if os.path.exists(path):
            swagger_path = path
            break

    if not swagger_path:
        return jsonify({
            "error": "swagger.json not found",
            "searched_paths": possible_paths,
            "cwd": os.getcwd(),
            "__file__": os.path.abspath(__file__)
        }), 404

    try:
        return send_file(swagger_path, mimetype='application/json')
    except Exception as e:
        return jsonify({"error": f"Error serving swagger.json: {str(e)}"}), 500
