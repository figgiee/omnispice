import { useState } from 'react';
import { useUser } from '@clerk/react';
import {
  useLtiPlatforms,
  useCreatePlatform,
  useDeletePlatform,
} from '../cloud/ltiAdminHooks';
import type { CreateLtiPlatformInput } from '../cloud/ltiAdminApi';

/**
 * Instructor-only LTI 1.3 platform registry page.
 *
 * Lists every registered `(iss, client_id)` tuple, lets the instructor
 * add a new row (validated client-side by Zod in the future — Phase 5),
 * and lets them delete an existing row with a confirm prompt.
 *
 * This is the UI for the Worker's /api/lti/platforms CRUD endpoints added
 * in 04-02 task 1.
 */
export function LtiAdminPage() {
  const { user, isLoaded } = useUser();
  const role = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const platforms = useLtiPlatforms();
  const createMutation = useCreatePlatform();
  const deleteMutation = useDeletePlatform();
  const [showForm, setShowForm] = useState(false);

  if (!isLoaded) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (role !== 'instructor') {
    return (
      <div style={{ padding: 24 }}>
        <h1>LTI Platform Registry</h1>
        <p>Instructor role required to access this page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22 }}>LTI 1.3 Platform Registry</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{ padding: '6px 12px' }}
        >
          {showForm ? 'Cancel' : 'Add Platform'}
        </button>
      </header>

      {showForm && (
        <PlatformForm
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
            setShowForm(false);
          }}
          isSubmitting={createMutation.isPending}
          error={createMutation.error?.message ?? null}
        />
      )}

      {platforms.isLoading && <p>Loading platforms...</p>}
      {platforms.error && (
        <p role="alert" style={{ color: '#f66' }}>
          Failed to load platforms: {platforms.error.message}
        </p>
      )}

      {platforms.data && platforms.data.length === 0 && (
        <p style={{ opacity: 0.7 }}>
          No LTI platforms registered yet. Click "Add Platform" to register your
          first Canvas or Moodle sandbox.
        </p>
      )}

      {platforms.data && platforms.data.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Issuer</th>
              <th style={th}>Client ID</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {platforms.data.map((p) => (
              <tr key={`${p.iss}|${p.client_id}`}>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.iss}</td>
                <td style={td}>{p.client_id}</td>
                <td style={td}>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete platform ${p.name} (${p.iss})? This is irreversible.`,
                        )
                      ) {
                        deleteMutation.mutate({
                          iss: p.iss,
                          clientId: p.client_id,
                        });
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #334',
  padding: '8px 4px',
  fontSize: 13,
};
const td: React.CSSProperties = {
  padding: '8px 4px',
  borderBottom: '1px solid #223',
  fontSize: 13,
};

interface PlatformFormProps {
  onSubmit: (input: CreateLtiPlatformInput) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

function PlatformForm({ onSubmit, isSubmitting, error }: PlatformFormProps) {
  const [iss, setIss] = useState('');
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [authLoginUrl, setAuthLoginUrl] = useState('');
  const [authTokenUrl, setAuthTokenUrl] = useState('');
  const [jwksUri, setJwksUri] = useState('');
  const [deploymentId, setDeploymentId] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          iss,
          client_id: clientId,
          deployment_id: deploymentId || undefined,
          name,
          auth_login_url: authLoginUrl,
          auth_token_url: authTokenUrl,
          jwks_uri: jwksUri,
        });
      }}
      style={{
        display: 'grid',
        gap: 8,
        marginBottom: 24,
        padding: 16,
        border: '1px solid #334',
      }}
    >
      <Field label="Name" value={name} onChange={setName} required />
      <Field
        label="Issuer (iss)"
        value={iss}
        onChange={setIss}
        placeholder="https://canvas.instructure.com"
        required
      />
      <Field label="Client ID" value={clientId} onChange={setClientId} required />
      <Field
        label="Deployment ID (optional)"
        value={deploymentId}
        onChange={setDeploymentId}
      />
      <Field
        label="OIDC Auth Login URL"
        value={authLoginUrl}
        onChange={setAuthLoginUrl}
        placeholder="https://canvas.instructure.com/api/lti/authorize_redirect"
        required
      />
      <Field
        label="OAuth2 Token URL"
        value={authTokenUrl}
        onChange={setAuthTokenUrl}
        placeholder="https://canvas.instructure.com/login/oauth2/token"
        required
      />
      <Field
        label="JWKS URI"
        value={jwksUri}
        onChange={setJwksUri}
        placeholder="https://canvas.instructure.com/api/lti/security/jwks"
        required
      />
      <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px' }}>
        {isSubmitting ? 'Saving...' : 'Register Platform'}
      </button>
      {error && (
        <p role="alert" style={{ color: '#f66' }}>
          {error}
        </p>
      )}
    </form>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

function Field({ label, value, onChange, placeholder, required }: FieldProps) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
      <span>
        {label}
        {required && <span style={{ color: '#f66' }}> *</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{ padding: 6, fontSize: 13 }}
      />
    </label>
  );
}
