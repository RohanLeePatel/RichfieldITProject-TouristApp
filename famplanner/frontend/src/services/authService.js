const USERS_KEY = "Roamio_users";

/* =========================================================
   HELPERS
========================================================= */

function getUsers() {
  const storedUsers = localStorage.getItem(USERS_KEY);

  if (!storedUsers) {
    return [];
  }

  try {
    return JSON.parse(storedUsers);
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/* =========================================================
   REGISTER
========================================================= */

export async function registerUser(data) {
  // Simulate a small API delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const users = getUsers();

  const existingUser = users.find(
    (user) =>
      user.email.toLowerCase() === data.email.toLowerCase()
  );

  if (existingUser) {
    throw new Error(
      "An account with this email already exists."
    );
  }

  const newUser = {
    id: crypto.randomUUID(),
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
  };

  const updatedUsers = [...users, newUser];

  saveUsers(updatedUsers);

  // Frontend-only mock token
  const token = `frontend-token-${newUser.id}`;

  return {
    user: newUser,
    token,
  };
}

/* =========================================================
   LOGIN
========================================================= */

export async function loginUser(data) {
  // Simulate a small API delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const users = getUsers();

  const user = users.find(
    (existingUser) =>
      existingUser.email.toLowerCase() ===
      data.email.toLowerCase()
  );

  if (!user) {
    throw new Error(
      "No account was found with this email."
    );
  }

  /*
   * FRONTEND-ONLY AUTHENTICATION
   *
   * There is currently no backend.
   * Passwords are therefore NOT securely stored or verified.
   *
   * This is mock authentication for frontend development.
   */

  const token = `frontend-token-${user.id}`;

  return {
    user,
    token,
  };
}