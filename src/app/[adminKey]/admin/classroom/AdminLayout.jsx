function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    router.push("/admin/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs rounded-full border border-admin-border px-3 py-1 hover:bg-admin-surfaceMuted"
    >
      Logout
    </button>
  );
}

export default AdminLogoutButton;