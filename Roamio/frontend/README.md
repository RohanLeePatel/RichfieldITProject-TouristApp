FamPlanner

FamPlanner is a family-focused planning web application designed to help users organise and manage family activities, trips, plans, and related information in one place.

The application is built with React and Vite and uses modern React libraries for routing, state management, and server-side data management.

Features
User registration
User login
User logout
Protected dashboard
Authentication state management
Client-side routing
Server-state management
Responsive user interface
Reusable React components
Modern icon library
Fast development with Vite
Technologies Used
Frontend
React
JavaScript
Vite
React Router
CSS
State Management
Zustand

Zustand is used to manage application state such as the currently authenticated user and authentication status.

Server State
TanStack Query

TanStack Query is used for handling server-side data, API requests, caching, and synchronization.

Icons
Lucide React
Development Tools
ESLint
Vite
Project Structure
famplanner-frontend/
│
├── public/
│   └── assets/
│
├── src/
│   │
│   ├── components/
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Dashboard.jsx
│   │
│   ├── store/
│   │   └── authStore.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── ...
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
Authentication

FamPlanner uses Zustand to manage authentication state.

The authentication store keeps track of:

Current logged-in user
Authentication status
Login state
Registration state
Logout state

Example authentication state:

{
  user: null,
  isAuthenticated: false
}

When a user successfully logs in or registers, the authentication state is updated.

When the user logs out, the user information is cleared and the authentication state is changed back to false.

Protected Routes

FamPlanner uses protected routes to restrict access to authenticated areas of the application.

For example, the dashboard is protected from users who are not logged in.

If a user attempts to access the dashboard without being authenticated, they are redirected to the login page.

The application uses React Router for navigation and Zustand to check the authentication state.

State Management
Zustand

Zustand manages client-side application state.

The authentication store is located at:

src/store/authStore.js

The store handles:

user
isAuthenticated
login()
register()
logout()
TanStack Query

TanStack Query is used for server-side data management.

It provides functionality for:

Fetching API data
Caching responses
Updating server data
Handling loading states
Handling errors
Synchronising server data

As the application grows, API-related functionality can be connected to TanStack Query without placing server data directly inside the authentication store.

Routing

React Router is used to manage navigation between application pages.

Current routes include:

/login
/register
/dashboard

The root route redirects users to the login page.

Getting Started
Requirements

Before running the project, make sure you have the following installed:

Node.js
npm
Git

You can check your Node.js version with:

node --version

You can check your npm version with:

npm --version
Installation

Clone the repository:

git clone <repository-url>

Move into the project directory:

cd famplanner-frontend

Install the project dependencies:

npm install
Running the Development Server

Start the Vite development server:

npm run dev

Vite will provide a local development address in the terminal.

Open that address in your browser to run FamPlanner locally.

Building the Application

To create a production build:

npm run build

The production files will be generated in the dist directory.

Previewing the Production Build

After creating a production build, you can preview it locally with:

npm run preview
Linting

The project uses ESLint to identify potential problems in the JavaScript and React code.

Run ESLint with:

npm run lint
Development Workflow

A typical development workflow is:

1. Start the development server
2. Make changes to the application
3. Test the changes in the browser
4. Check the browser console for errors
5. Run ESLint
6. Create a production build
7. Commit the working changes
Environment Variables

Environment variables should be stored in a local environment file rather than directly inside source code.

For example:

.env

Sensitive information such as:

API keys
Authentication secrets
Database credentials
Private tokens

should not be committed to the Git repository.

Environment files containing secrets should be included in .gitignore.

JavaScript

FamPlanner is written using JavaScript and React.

The project does not use TypeScript for its application source code.

The main source file extensions are:

.js
.jsx
Dependencies

The main application dependencies include:

React

Used to build the user interface and application components.

React Router

Used for navigation and page routing.

Zustand

Used for client-side state management, including authentication.

TanStack Query

Used for server-side data fetching and caching.

Lucide React

Used for interface icons.

Vite

Used as the development server and build tool.

Project Scripts

The following npm scripts are available:

npm run dev

Starts the development server.

npm run build

Creates a production build.

npm run lint

Runs ESLint.

npm run preview

Previews the production build locally.

Browser Support

FamPlanner is designed to run in modern web browsers that support current JavaScript, CSS, and React features.

Recommended browsers include:

Google Chrome
Microsoft Edge
Mozilla Firefox
Safari
Future Improvements

Planned improvements may include:

Family trip planning
Shared family schedules
Activity management
Family profiles
Notifications
Calendar integration
API integration
Improved dashboard functionality
Additional authentication features
Persistent user sessions
More advanced family planning tools
Development Notes

FamPlanner is currently being developed as a React frontend application.

The application architecture is designed to separate:

UI components
Pages
Authentication state
Server-side data
Routing
Application logic

This makes the project easier to maintain and expand as additional features are introduced.

License

This project is currently intended for educational and development purposes.

Author

FamPlanner