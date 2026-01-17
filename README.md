# Hot Take API

GraphQL API built with Node.js, Express, Apollo Server, MongoDB, WebSocket

Features:
  * User Authentication: Uses JWT authorization with role-based permissions.
  * Posts & Voting: Users can create posts with a controversy rating based on votes received
  * Real Time Updates: WebSocket subscriptions for posts and staff messages
  * Staff Chat: Private channel for staff messaging
  * Cursor Pagination: Efficient pagination for posts & messages
  * Transaction Safety: MongoDB transaction to prevent race condition when voting
  * Rate Limiting: Prevent API abuse
  * Validation: Validate user inputs and requests
