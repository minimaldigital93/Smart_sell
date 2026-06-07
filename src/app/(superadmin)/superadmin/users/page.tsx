import { getAllUsers } from "@/services/platform";
import { UserRoleSelect } from "@/components/superadmin/user-role-select";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await getAllUsers();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {users.length} accounts across all stores.
        </p>
      </header>

      <div className="bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Phone</th>
              <th className="px-4 py-2 text-left font-medium">Store</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-2">{u.name ?? "—"}</td>
                <td className="px-4 py-2">{u.phone ?? "—"}</td>
                <td className="px-4 py-2">
                  {u.store ? (
                    <>
                      {u.store.name}
                      <span className="text-muted-foreground ml-1 text-xs">
                        /{u.store.slug}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">platform</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <UserRoleSelect userId={u.id} role={u.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
