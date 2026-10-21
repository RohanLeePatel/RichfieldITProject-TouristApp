import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { loginUser as loginRequest } from "../services/authService";

export function useLogin() {
  const loginUser = useAuthStore((state) => state.login);

  return useMutation({
    mutationFn: loginRequest,

    onSuccess: ({ user, token }) => {
      loginUser(user, token);
    },
  });
}
