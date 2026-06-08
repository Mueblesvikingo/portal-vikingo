import { useState } from "react";
import {
  loginWithUserAndPassword,
  saveSession,
} from "../../services/authService";

export default function LoginModule({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const user = await loginWithUserAndPassword(
        usuario,
        password
      );

      saveSession(user);

      if (onLogin) {
        onLogin(user);
      }
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[#071226]">
            VIKINGO
          </h1>

          <p className="mt-2 text-slate-500">
            Portal Estratégico
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-semibold mb-2">
              Usuario
            </label>

            <input
              type="text"
              value={usuario}
              onChange={(e) =>
                setUsuario(e.target.value)
              }
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Contraseña
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full border border-slate-300 rounded-xl px-4 py-3"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl"
          >
            {loading
              ? "Ingresando..."
              : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}