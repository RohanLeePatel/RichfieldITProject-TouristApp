import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  registerUser as registerRequest,
  verifyEmail as verifyRequest,
  resendVerificationCode as resendRequest,
} from "../services/authService";

// Step 1: create the account. The backend emails a code and starts no
// session, so the caller moves on to the code step with the returned email.
export function useRegister() {
  return useMutation({
    mutationFn: ({ name, email, password }) =>
      registerRequest({ fullName: name, email, password }),
  });
}

// Step 2: the emailed code. Success returns a real session.
export function useVerifyEmail() {
  const registerUser = useAuthStore((state) => state.register);

  return useMutation({
    mutationFn: verifyRequest,

    onSuccess: ({ user, token }) => {
      registerUser(user, token);
    },
  });
}

export function useResendCode() {
  return useMutation({ mutationFn: resendRequest });
}
