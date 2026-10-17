import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";

export function useLogin() {
  const loginUser = useAuthStore((state) => state.login);

  return useMutation({
    mutationFn: async (loginData) => {
      // Frontend-only login for now.
      // No backend is being used.

      const user = {
        id: Date.now(),
        firstName: "FamPlanner",
        lastName: "User",
        email: loginData.email,
      };

      return {
        user,
      };
    },

    onSuccess: (data) => {
      loginUser(data.user);
    },
  });
}