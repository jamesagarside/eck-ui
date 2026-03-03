// Beat List Page
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiBasicTable,
  EuiHealth,
  EuiBadge,
  EuiFieldSearch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFilterGroup,
  EuiFilterButton,
  EuiLink,
  EuiFilterSelectItem,
  EuiPopover,
  EuiSpacer,
} from '@elastic/eui';
import type { EuiBasicTableColumn, Criteria } from '@elastic/eui';
import { useBeatList } from '../../hooks/useResources';
import type { Beat, HealthStatus } from '../../types/resources';
import { ListSkeleton } from '../../components/common/Skeletons';

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Beat types in ECK
const beatTypes = [
  { value: 'filebeat', label: 'Filebeat' },
  { value: 'metricbeat', label: 'Metricbeat' },
  { value: 'heartbeat', label: 'Heartbeat' },
  { value: 'packetbeat', label: 'Packetbeat' },
  { value: 'auditbeat', label: 'Auditbeat' },
  { value: 'journalbeat', label: 'Journalbeat' },
];

interface BeatRow {
  id: string;
  name: string;
  namespace: string;
  type: string;
  version: string;
  health: HealthStatus;
  phase: string;
  esRef: string;
  nodes: string;
  createdAt?: string;
}

function getHealthColor(health: HealthStatus): 'success' | 'warning' | 'danger' | 'subdued' {
  switch (health) {
    case 'green':
      return 'success';
    case 'yellow':
      return 'warning';
    case 'red':
      return 'danger';
    default:
      return 'subdued';
  }
}

export function BeatListPage() {
  const navigate = useNavigate();
  const { data: rawBeats, isLoading, error } = useBeatList();

  const beats = rawBeats as { data: Beat[] } | undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHealth, setSelectedHealth] = useState<HealthStatus[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isTypePopoverOpen, setIsTypePopoverOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof BeatRow>('name');
  const [sortDirection, setDirection] = useState<'asc' | 'desc'>('asc');

  const beatsList = useMemo((): BeatRow[] => {
    if (!beats?.data) return [];

    return beats.data.map((beat: Beat) => ({
      id: `${beat.metadata.namespace}/${beat.metadata.name}`,
      name: beat.metadata.name,
      namespace: beat.metadata.namespace,
      type: beat.spec.type || 'unknown',
      version: beat.spec.version,
      health: beat.status?.health || 'unknown',
      phase: beat.status?.phase || 'Unknown',
      esRef: beat.spec.elasticsearchRef?.name || 'Not configured',
      nodes: beat.status?.availableNodes !== undefined && beat.status?.expectedNodes !== undefined
        ? `${beat.status.availableNodes}/${beat.status.expectedNodes}`
        : '-',
      createdAt: beat.metadata.creationTimestamp,
    }));
  }, [beats]);

  const filteredBeats = useMemo(() => {
    let filtered = beatsList;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (beat) =>
          beat.name.toLowerCase().includes(query) ||
          beat.namespace.toLowerCase().includes(query) ||
          beat.type.toLowerCase().includes(query)
      );
    }

    if (selectedHealth.length > 0) {
      filtered = filtered.filter((beat) => selectedHealth.includes(beat.health));
    }

    if (selectedTypes.length > 0) {
      filtered = filtered.filter((beat) => selectedTypes.includes(beat.type));
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue === undefined || bValue === undefined) return 0;
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [beatsList, searchQuery, selectedHealth, selectedTypes, sortField, sortDirection]);

  const columns: EuiBasicTableColumn<BeatRow>[] = [
    {
      field: 'name',
      name: 'Name',
      sortable: true,
      render: (name: string, item: BeatRow) => (
        <EuiLink onClick={() => navigate(`/beats/${item.namespace}/${name}`)}>
          {name}
        </EuiLink>
      ),
    },
    {
      field: 'namespace',
      name: 'Namespace',
      sortable: true,
    },
    {
      field: 'type',
      name: 'Type',
      sortable: true,
      render: (type: string) => {
        const typeInfo = beatTypes.find((t) => t.value === type);
        return <EuiBadge color="hollow">{typeInfo?.label || type}</EuiBadge>;
      },
    },
    {
      field: 'version',
      name: 'Version',
      sortable: true,
    },
    {
      field: 'health',
      name: 'Health',
      sortable: true,
      render: (health: HealthStatus) => (
        <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>
      ),
    },
    {
      field: 'phase',
      name: 'Phase',
      sortable: true,
      render: (phase: string) => {
        let color: 'success' | 'warning' | 'danger' | 'default' = 'default';
        if (phase === 'Ready') color = 'success';
        else if (phase === 'Pending' || phase === 'ApplyingChanges') color = 'warning';
        return <EuiBadge color={color}>{phase}</EuiBadge>;
      },
    },
    {
      field: 'esRef',
      name: 'Elasticsearch',
      sortable: true,
      render: (esRef: string) => (
        esRef !== 'Not configured' ? (
          <EuiLink onClick={() => navigate(`/elasticsearch?search=${esRef}`)}>
            {esRef}
          </EuiLink>
        ) : (
          <span style={{ color: '#999' }}>{esRef}</span>
        )
      ),
    },
    {
      field: 'nodes',
      name: 'Nodes',
      sortable: false,
    },
    {
      field: 'createdAt',
      name: 'Created',
      sortable: true,
      render: (timestamp: string | undefined) => timestamp ? formatRelativeTime(timestamp) : '-',
    },
  ];

  const onTableChange = ({ sort }: Criteria<BeatRow>) => {
    if (sort) {
      setSortField(sort.field as keyof BeatRow);
      setDirection(sort.direction);
    }
  };

  const toggleHealth = (health: HealthStatus) => {
    setSelectedHealth((prev) =>
      prev.includes(health)
        ? prev.filter((h) => h !== health)
        : [...prev, health]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <ListSkeleton />
      </EuiPageTemplate>
    );
  }

  if (error) {
    return (
      <EuiPageTemplate>
        <EuiPageHeader
          pageTitle="Beats"
          description="Error loading Beats"
        />
      </EuiPageTemplate>
    );
  }

  const typeFilterOptions = beatTypes.map((type) => ({
    label: type.label,
    key: type.value,
    checked: selectedTypes.includes(type.value) ? ('on' as const) : undefined,
  }));

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Beats"
        description={`Manage Filebeat, Metricbeat, and other Beat instances`}
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => navigate('/beats/create')}
          >
            Create Beat
          </EuiButton>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiFlexGroup gutterSize="m" alignItems="center">
          <EuiFlexItem grow={false} style={{ width: 300 }}>
            <EuiFieldSearch
              placeholder="Search beats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              isClearable
              aria-label="Search beats"
            />
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiFilterGroup>
              <EuiFilterButton
                hasActiveFilters={selectedHealth.includes('green')}
                onClick={() => toggleHealth('green')}
              >
                Healthy
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={selectedHealth.includes('yellow')}
                onClick={() => toggleHealth('yellow')}
              >
                Warning
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={selectedHealth.includes('red')}
                onClick={() => toggleHealth('red')}
              >
                Critical
              </EuiFilterButton>
            </EuiFilterGroup>
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiPopover
              button={
                <EuiFilterButton
                  iconType="arrowDown"
                  onClick={() => setIsTypePopoverOpen(!isTypePopoverOpen)}
                  isSelected={isTypePopoverOpen}
                  numFilters={beatTypes.length}
                  hasActiveFilters={selectedTypes.length > 0}
                  numActiveFilters={selectedTypes.length}
                >
                  Type
                </EuiFilterButton>
              }
              isOpen={isTypePopoverOpen}
              closePopover={() => setIsTypePopoverOpen(false)}
              panelPaddingSize="none"
            >
              <div style={{ width: 200 }}>
                {typeFilterOptions.map((option) => (
                  <EuiFilterSelectItem
                    key={option.key}
                    checked={option.checked}
                    onClick={() => toggleType(option.key!)}
                  >
                    {option.label}
                  </EuiFilterSelectItem>
                ))}
              </div>
            </EuiPopover>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="m" />

        <EuiBasicTable
          items={filteredBeats}
          columns={columns}
          sorting={{
            sort: {
              field: sortField,
              direction: sortDirection,
            },
          }}
          onChange={onTableChange}
          tableLayout="auto"
          rowProps={(item: BeatRow) => ({
            onClick: () => navigate(`/beats/${item.namespace}/${item.name}`),
            style: { cursor: 'pointer' },
          })}
        />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
