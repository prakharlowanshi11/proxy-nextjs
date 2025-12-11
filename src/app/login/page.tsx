"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthApi } from "@/lib/api/auth";
import { loginWithGooglePopup } from "@/lib/auth/firebase";
import { getAuthToken, setAuthToken } from "@/lib/auth/token";

const description = [
  {
    title: "Feature of SAAR",
    list: [
      "Flexible Proxy Pass",
      "Custom Gateway Domains",
      "Real-time Analytics",
      "Developer-Friendly Documentation",
      "Secure your APIs",
    ],
  },
  {
    title: "Why choose SAAR?",
    list: ["Secure and Reliable", "Future-Proof Solution", "User-Centric Design"],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAuthToken()) {
      router.replace("/app/logs");
    }
  }, [router]);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { idToken } = await loginWithGooglePopup();
      const response = await AuthApi.googleLogin(idToken);
      const proxyToken = response.data?.auth;
      if (!proxyToken) {
        throw new Error("Authentication token missing in response.");
      }
      setAuthToken(proxyToken);
      router.push("/app/logs");
    } catch (err) {
      console.error("Google login failed", err);
      setError(err instanceof Error ? err.message : "Unable to complete login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface flex flex-col lg:flex-row">
      <section className="hidden lg:flex lg:w-2/5 flex-col gap-8 bg-[rgba(123,127,130,0.07)] px-12 py-20">
        <p className="text-4xl font-semibold tracking-wide text-[#3f4346]">SAAR</p>
        <p className="text-base leading-6 text-[#3f4346] max-w-md">
          Take your API management to new heights with SAAR. Sign up for a free trial today and experience
          the seamless management of APIs and proxy-pass like never before!
        </p>
        <div className="space-y-8">
          {description.map((section) => (
            <div key={section.title} className="space-y-3">
              <p className="text-xl font-semibold text-[#212528]">{section.title}</p>
              <div className="space-y-2">
                {section.list.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-[#3f4346]">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#3f51b5] shadow-sm">
                      ✓
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex-1 flex flex-col justify-center px-8 py-16 lg:px-24">
        <div className="max-w-md space-y-6">
          <div>
            <p className="text-2xl font-semibold text-[#212528]">Welcome back!</p>
            <p className="text-sm text-[#5d6164] mt-1">Login with</p>
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-[#d5d9dc] rounded-full px-6 py-3 text-sm font-medium hover:border-[#3f51b5] hover:text-[#3f51b5] transition-colors disabled:opacity-60"
          >
            <Image src="/assets/images/logos/google-logo.svg" alt="Google" width={18} height={18} />
            {loading ? "Signing in…" : "Google"}
          </button>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="space-y-2 pt-6 text-sm text-[#5d6164]">
            <p>
              Need access?{" "}
              <button className="text-[#3f51b5] font-medium hover:underline" onClick={() => router.push("/project")}>
                Create your workspace
              </button>
            </p>
            <p className="text-xs">By continuing you agree to our Terms and acknowledge the Privacy Policy.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
