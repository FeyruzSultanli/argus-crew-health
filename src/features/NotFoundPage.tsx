import { Link } from 'react-router';

import { PlaceholderPage } from '../ui/PlaceholderPage';

export default function NotFoundPage() {
  return (
    <PlaceholderPage
      title="Page not found"
      summary="This address does not match any ARGUS screen."
    >
      <p className="mt-4">
        <Link to="/" className="inline-flex min-h-target items-center text-brand underline">
          Back to the Mission Bridge
        </Link>
      </p>
    </PlaceholderPage>
  );
}
