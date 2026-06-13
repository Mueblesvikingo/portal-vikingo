import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({
  children,
  currentUser,
  onLogout,
}) {
  return (
    <div className="flex min-h-screen w-screen overflow-hidden bg-[#f4f6f8]">
     <Sidebar currentUser={currentUser} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          currentUser={currentUser}
          onLogout={onLogout}
        />

        <main className="min-w-0 flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}