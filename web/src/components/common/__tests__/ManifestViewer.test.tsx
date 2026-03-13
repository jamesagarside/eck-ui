import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../../test/utils';
import { ManifestViewer } from '../ManifestViewer';

describe('ManifestViewer', () => {
  const sampleResource = {
    apiVersion: 'elasticsearch.k8s.elastic.co/v1',
    kind: 'Elasticsearch',
    metadata: {
      name: 'quickstart',
      namespace: 'elastic-system',
    },
    spec: {
      version: '8.15.0',
      nodeSets: [
        {
          name: 'default',
          count: 3,
        },
      ],
    },
  };

  it('renders the resource as YAML in the editor', () => {
    render(<ManifestViewer resource={sampleResource} />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toBeInTheDocument();

    const value = (textarea as HTMLTextAreaElement).value;
    expect(value).toContain('apiVersion: elasticsearch.k8s.elastic.co/v1');
    expect(value).toContain('kind: Elasticsearch');
    expect(value).toContain('name: quickstart');
    expect(value).toContain('namespace: elastic-system');
    // YAML stringify may or may not quote the version string
    expect(value).toContain('version:');
    expect(value).toContain('8.15.0');
    expect(value).toContain('count: 3');
  });

  it('shows the default "Manifest" title', () => {
    render(<ManifestViewer resource={sampleResource} />);
    expect(screen.getByText('Manifest')).toBeInTheDocument();
  });

  it('shows a custom title when provided', () => {
    render(<ManifestViewer resource={sampleResource} title="Resource YAML" />);
    expect(screen.getByText('Resource YAML')).toBeInTheDocument();
    expect(screen.queryByText('Manifest')).not.toBeInTheDocument();
  });

  it('renders a copy button with the correct aria label', () => {
    render(<ManifestViewer resource={sampleResource} />);

    const copyButton = screen.getByRole('button', { name: /copy manifest to clipboard/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('uses a read-only YamlEditor', () => {
    render(<ManifestViewer resource={sampleResource} />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toHaveAttribute('readonly');
  });

  it('renders an empty resource correctly', () => {
    render(<ManifestViewer resource={{}} />);

    const textarea = screen.getByLabelText('YAML editor');
    const value = (textarea as HTMLTextAreaElement).value;
    expect(value).toContain('{}');
  });

  it('handles nested resource data', () => {
    const nested = {
      metadata: {
        labels: {
          app: 'elasticsearch',
          'eck-ui/deployment': 'production',
        },
        annotations: {
          'eck.k8s.elastic.co/managed': 'true',
        },
      },
    };

    render(<ManifestViewer resource={nested} />);

    const textarea = screen.getByLabelText('YAML editor');
    const value = (textarea as HTMLTextAreaElement).value;
    expect(value).toContain('app: elasticsearch');
    expect(value).toContain('eck-ui/deployment: production');
    expect(value).toContain('eck.k8s.elastic.co/managed');
  });
});
