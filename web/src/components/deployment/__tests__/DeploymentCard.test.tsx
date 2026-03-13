import { render, screen } from '../../../test/utils';
import { DeploymentCard } from '../DeploymentCard';
import type { Deployment, DeploymentComponent, DeployableResourceType } from '../../../types/deployment';

function makeDeployment(overrides?: Partial<Deployment>): Deployment {
  return {
    name: 'test-deploy',
    namespace: 'default',
    version: '8.12.0',
    health: 'green',
    createdAt: new Date().toISOString(),
    components: [],
    ...overrides,
  };
}

function makeComponent(
  type: DeployableResourceType,
  name: string,
  namespace = 'default',
): DeploymentComponent {
  return {
    type,
    suffix: `-${type}`,
    resource: {
      apiVersion: `${type}.k8s.elastic.co/v1`,
      kind: type,
      metadata: {
        name,
        namespace,
        resourceVersion: '1',
        creationTimestamp: new Date().toISOString(),
      },
      status: {
        health: 'green' as const,
        phase: 'Ready',
        version: '8.12.0',
      },
    },
  };
}

describe('DeploymentCard', () => {
  it('renders deployment name, namespace, and version', () => {
    const deployment = makeDeployment({
      name: 'my-stack',
      namespace: 'production',
      version: '8.15.1',
    });

    render(<DeploymentCard deployment={deployment} />);

    expect(screen.getByText('my-stack')).toBeInTheDocument();
    expect(screen.getByText('production \u00B7 v8.15.1')).toBeInTheDocument();
  });

  it('renders component type badges for each component', () => {
    const deployment = makeDeployment({
      components: [
        makeComponent('elasticsearch', 'test-deploy-es'),
        makeComponent('kibana', 'test-deploy-kb'),
        makeComponent('apm', 'test-deploy-apm'),
      ],
    });

    render(<DeploymentCard deployment={deployment} />);

    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('KB')).toBeInTheDocument();
    expect(screen.getByText('APM')).toBeInTheDocument();
  });

  it('renders Open Kibana link button when Kibana component exists', () => {
    const deployment = makeDeployment({
      components: [makeComponent('kibana', 'test-deploy-kb', 'default')],
    });

    render(<DeploymentCard deployment={deployment} />);

    const kibanaButton = screen.getByRole('link', { name: /open kibana/i });
    expect(kibanaButton).toBeInTheDocument();
    expect(kibanaButton).toHaveAttribute(
      'href',
      'https://test-deploy-kb-kb-http.default.svc:5601',
    );
    expect(kibanaButton).toHaveAttribute('target', '_blank');
  });

  it('renders ES Endpoint copy button when Elasticsearch component exists', () => {
    const deployment = makeDeployment({
      components: [makeComponent('elasticsearch', 'test-deploy-es', 'elastic')],
    });

    render(<DeploymentCard deployment={deployment} />);

    expect(screen.getByRole('button', { name: /es endpoint/i })).toBeInTheDocument();
  });

  it('does not render endpoint buttons when no matching components exist', () => {
    const deployment = makeDeployment({
      components: [makeComponent('logstash', 'test-deploy-ls')],
    });

    render(<DeploymentCard deployment={deployment} />);

    // Badge for logstash should render
    expect(screen.getByText('LS')).toBeInTheDocument();

    // No endpoint buttons should be present
    expect(screen.queryByRole('link', { name: /open kibana/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /es endpoint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apm endpoint/i })).not.toBeInTheDocument();
  });
});
