import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";

interface LoginData {
  email: string;
  password: string;
}

export function useLogin() {
  const login = useAuthStore((state) => state.login);

  const mutation = useMutation({
    mutationFn: async ({ email, password }: LoginData) => {
      // --------------------------------------------------
      // FRONTEND-ONLY LOGIN
      // --------------------------------------------------
      // There is no backend yet.
      // This simulates a login request so that
      // TanStack Query can manage the request state.
      // --------------------------------------------------

      await new Promise((resolve) => {
        setTimeout(resolve, 800);
      });

      // Basic frontend validation
      if (!email || !password) {
        throw new Error("Please enter your email and password.");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      // Create a temporary user
      const user = {
        id: crypto.randomUUID(),
        name: email.split("@")[0],
        email: email,
      };

      return {
        success: true,
        user,
      };
    },

    // --------------------------------------------------
    // LOGIN SUCCESS
    // --------------------------------------------------

    onSuccess: (data) => {
      login(data.user);
    },
  });

  return mutation;
}