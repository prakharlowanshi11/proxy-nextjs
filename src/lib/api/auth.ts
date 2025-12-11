import { proxyRequest } from "./client";

export const AuthApi = {
  googleLogin: (idToken: string) =>
    proxyRequest<{ auth: string }>("googleLogin", {
      method: "POST",
      headers: {
        Authorization: idToken,
      },
      body: {},
    }),
  logout: () => proxyRequest<{ message: string }>("logout", { method: "DELETE" }),
};
