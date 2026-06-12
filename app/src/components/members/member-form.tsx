// app/src/components/members/member-form.tsx

export type MemberFormProps = {
  branches: { branchId: number; name: string }[];
  stages: { stageCode: string; name: string; orderIndex: number }[];
  defaultValues?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: string;
    maritalStatus?: string;
    email?: string;
    mobile?: string;
    branchId?: number;
    currentStage?: string;
    joinedAt?: string;
  };
  errors?: Record<string, string[]>;
};

export function MemberForm({
  branches,
  stages,
  defaultValues = {},
  errors = {},
}: MemberFormProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            First name <span className="text-red-500">*</span>
          </label>
          <input
            name="firstName"
            defaultValue={defaultValues.firstName}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-600">{errors.firstName[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Middle name
          </label>
          <input
            name="middleName"
            defaultValue={defaultValues.middleName}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            name="lastName"
            defaultValue={defaultValues.lastName}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-600">{errors.lastName[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Gender
          </label>
          <select
            name="gender"
            defaultValue={defaultValues.gender}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="UNDISCLOSED">Undisclosed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Birthday
          </label>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={defaultValues.dateOfBirth}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            name="email"
            type="email"
            defaultValue={defaultValues.email}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mobile
          </label>
          <input
            name="mobile"
            defaultValue={defaultValues.mobile}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Branch <span className="text-red-500">*</span>
          </label>
          <select
            name="branchId"
            defaultValue={defaultValues.branchId}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.branchId && (
            <p className="mt-1 text-xs text-red-600">{errors.branchId[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Lifecycle stage <span className="text-red-500">*</span>
          </label>
          <select
            name="currentStage"
            defaultValue={defaultValues.currentStage}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select stage…</option>
            {stages.map((s) => (
              <option key={s.stageCode} value={s.stageCode}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.currentStage && (
            <p className="mt-1 text-xs text-red-600">
              {errors.currentStage[0]}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Joined date <span className="text-red-500">*</span>
          </label>
          <input
            name="joinedAt"
            type="date"
            defaultValue={defaultValues.joinedAt}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {errors.joinedAt && (
            <p className="mt-1 text-xs text-red-600">{errors.joinedAt[0]}</p>
          )}
        </div>
      </div>
    </div>
  );
}
