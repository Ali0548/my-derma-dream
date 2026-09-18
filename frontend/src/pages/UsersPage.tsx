import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { usersApi, type UserRow } from '../api/users';
import { DataTable } from '../components/ui/DataTable';
import { ComponentLoader } from '../components/ui/ComponentLoader';

export default function UsersPage() {
  const query = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.list();
      return res.data;
    },
  });

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
      },
      {
        id: 'role',
        accessorKey: 'role',
        header: 'Role',
        cell: ({ getValue }) => (
          <span className="inline-flex rounded-full bg-foam px-2.5 py-1 text-[0.72rem] font-extrabold capitalize text-brand-deep">
            {String(getValue())}
          </span>
        ),
      },
      {
        id: 'isActive',
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => (getValue() ? 'Active' : 'Inactive'),
        filterFn: (row, id, value) => {
          if (!value) return true;
          const active = row.getValue<boolean>(id);
          return value === 'active' ? active : !active;
        },
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) =>
          new Date(String(getValue())).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
      },
    ],
    [],
  );

  if (query.isLoading) {
    return <ComponentLoader label="Loading users" rows={5} />;
  }

  if (query.isError) {
    return (
      <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
        Could not load users. Please try again.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-3 shadow-soft sm:p-4">
      <DataTable
        title="Users"
        data={query.data ?? []}
        columns={columns}
        exportFileName="lumora-users"
        searchPlaceholder="Search by name, email, role…"
        filters={[
          {
            id: 'role',
            label: 'Role',
            options: [
              { label: 'Admin', value: 'admin' },
              { label: 'Manager', value: 'manager' },
            ],
          },
          {
            id: 'isActive',
            label: 'Status',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
          },
        ]}
      />
    </div>
  );
}
