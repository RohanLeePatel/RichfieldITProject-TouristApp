import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";

export function useRegister() {
  const registerUser = useAuthStore((state) => state.register);

  return useMutation({
    mutationFn: async (registerData) => {
      // Frontend-only registration for now.
      // No backend is being used.

      const user = {
        id: Date.now(),
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        email: registerData.email,
      };

      return {
        user,
      };
    },

    onSuccess: (data) => {
      registerUser(data.user);
    },
  });
}