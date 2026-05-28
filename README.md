Project Structure
/backend: The Node.js, Express, and Socket.io server. Uses MongoDB for database.

/player_app: The Flutter/Dart mobile application. Allows participants to join active rooms via a PIN and submit answers.

1. Start the backend
- cd backend
- npm install
- node server.js
2. Start the app
- cd player_app
- flutter pub get
- flutter run
- add your own ipv4 address in the dart file available under lib folder
