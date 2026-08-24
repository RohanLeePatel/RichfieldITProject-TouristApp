import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";

type RegisterData = {
  name: string;
  email: string;
  password: string;
};

export function useRegister() {
  const registerUser = useAuthStore((state) => state.register);

  const mutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      /*
       * FRONTEND ONLY
       *
       * There is no backend yet.
       * We simulate a registration request.
       */

      await new Promise((resolve) => {
        setTimeout(resolve, 800);
      });

      const user = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
      };

      return user;
    },

    onSuccess: (user) => {
      registerUser(user);
    },
  });

  return mutation;
}