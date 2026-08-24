export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

const USERS_KEY = "famplanner_users";

/* =========================================================
   HELPERS
========================================================= */

function getUsers(): User[] {
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

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/* =========================================================
   REGISTER
========================================================= */

export async function registerUser(
  data: RegisterData
): Promise<AuthResponse> {
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

  const newUser: User = {
    id: crypto.randomUUID(),
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
  };

  const updatedUsers = [...users, newUser];

  saveUsers(updatedUsers);

  const token = `frontend-token-${newUser.id}`;

  return {
    user: newUser,
    token,
  };
}

/* =========================================================
   LOGIN
========================================================= */

export async function loginUser(
  data: LoginData
): Promise<AuthResponse> {
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
   * FRONTEND-ONLY NOTE:
   *
   * Passwords are not being securely stored because
   * there is no backend yet.
   *
   * This is only mock authentication for frontend
   * development.
   */

  const token = `frontend-token-${user.id}`;

  return {
    user,
    token,
  };
}