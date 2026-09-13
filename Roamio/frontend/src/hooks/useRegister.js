import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  registerUser as registerRequest,
  loginUser as loginRequest,
} from "../services/authService";

export function useRegister() {
  const registerUser = useAuthStore((state) => state.register);

  return useMutation({
    mutationFn: async ({ name, email, password }) => {
      await registerRequest({ fullName: name, email, password });
      // Registration doesn't return a token - log straight in so the user
      // ends up with a real session instead of a half-authenticated one.
      return loginRequest({ email, password });
    },

    onSuccess: ({ user, token }) => {
      registerUser(user, token);
    },
  });
}
