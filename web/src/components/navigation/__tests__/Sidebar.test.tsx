import { render, screen } from '../../../test/utils';
import { Sidebar } from '../Sidebar';
import { useAuthStore } from '../../../stores/authStore';

function setUser(groups: string[]) {
  useAuthStore.setState({
    user: { username: 'test', uid: '1', groups },
    isAuthenticated: true,
  });
}

afterEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('Sidebar', () => {
  describe('viewer role', () => {
    beforeEach(() => {
      setUser(['viewers']);
    });

    it('shows My Deployments and Settings links', () => {
      render(<Sidebar />);

      expect(screen.getByText('My Deployments')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('does not show Resources section', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    });

    it('does not show Administration section', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    });

    it('does not show Dashboard', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('does not show Stack Management', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Stack Management')).not.toBeInTheDocument();
    });
  });

  describe('admin role', () => {
    beforeEach(() => {
      setUser(['cluster-admin']);
    });

    it('shows Dashboard', () => {
      render(<Sidebar />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('shows Deployments', () => {
      render(<Sidebar />);

      expect(screen.getByText('Deployments')).toBeInTheDocument();
    });

    it('shows Resources section with all resource types', () => {
      render(<Sidebar />);

      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
      expect(screen.getByText('Kibana')).toBeInTheDocument();
      expect(screen.getByText('Fleet Server')).toBeInTheDocument();
      expect(screen.getByText('Elastic Agent')).toBeInTheDocument();
      expect(screen.getByText('APM Server')).toBeInTheDocument();
      expect(screen.getByText('Beats')).toBeInTheDocument();
      expect(screen.getByText('Logstash')).toBeInTheDocument();
      expect(screen.getByText('Enterprise Search')).toBeInTheDocument();
      expect(screen.getByText('Elastic Maps')).toBeInTheDocument();
    });

    it('shows Stack Management section', () => {
      render(<Sidebar />);

      expect(screen.getByText('Stack Management')).toBeInTheDocument();
      expect(screen.getByText('Config Policies')).toBeInTheDocument();
      expect(screen.getByText('Autoscalers')).toBeInTheDocument();
    });

    it('shows Administration section', () => {
      render(<Sidebar />);

      expect(screen.getByText('Administration')).toBeInTheDocument();
      expect(screen.getByText('Versions')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('System Info')).toBeInTheDocument();
    });
  });

  describe('editor role', () => {
    beforeEach(() => {
      setUser(['platform-editors']);
    });

    it('shows Dashboard, Deployments, Resources, and Stack Management', () => {
      render(<Sidebar />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Deployments')).toBeInTheDocument();
      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(screen.getByText('Stack Management')).toBeInTheDocument();
    });

    it('does not show Administration section', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    });
  });

  describe('navigation aria label', () => {
    it('renders with accessible navigation label', () => {
      setUser(['cluster-admin']);
      render(<Sidebar />);

      expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
    });

    it('renders with accessible navigation label for viewer', () => {
      setUser(['viewers']);
      render(<Sidebar />);

      expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
    });
  });
});
