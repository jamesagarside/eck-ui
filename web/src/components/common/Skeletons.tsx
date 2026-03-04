import {
  EuiSkeletonText,
  EuiSkeletonTitle,
  EuiSkeletonRectangle,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
} from '@elastic/eui';

// Skeleton for list pages
export function ListSkeleton() {
  return (
    <>
      {/* Page header skeleton */}
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiSkeletonTitle size="l" />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiSkeletonRectangle width={120} height={40} />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      {/* Search and filter skeleton */}
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiSkeletonRectangle width="100%" height={40} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiSkeletonRectangle width={150} height={40} />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {/* Table skeleton */}
      <EuiPanel paddingSize="none">
        {/* Table header */}
        <div style={{ borderBottom: '1px solid #d3dae6', padding: '12px 16px' }}>
          <EuiFlexGroup>
            {[1, 2, 3, 4, 5].map((i) => (
              <EuiFlexItem key={i}>
                <EuiSkeletonRectangle width="80%" height={16} />
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </div>

        {/* Table rows */}
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} style={{ borderBottom: '1px solid #d3dae6', padding: '12px 16px' }}>
            <EuiFlexGroup alignItems="center">
              {[1, 2, 3, 4, 5].map((col) => (
                <EuiFlexItem key={col}>
                  <EuiSkeletonText lines={1} />
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </div>
        ))}
      </EuiPanel>
    </>
  );
}

// Skeleton for detail pages
export function DetailSkeleton() {
  return (
    <>
      {/* Page header skeleton */}
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiFlexGroup alignItems="center" gutterSize="m">
            <EuiFlexItem grow={false}>
              <EuiSkeletonRectangle width={48} height={48} />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiSkeletonTitle size="m" />
              <EuiSkeletonText lines={1} />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="s">
            <EuiFlexItem>
              <EuiSkeletonRectangle width={100} height={40} />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiSkeletonRectangle width={100} height={40} />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      {/* Tabs skeleton */}
      <EuiFlexGroup gutterSize="m">
        {[1, 2, 3, 4].map((i) => (
          <EuiFlexItem key={i} grow={false}>
            <EuiSkeletonRectangle width={80} height={32} />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      {/* Content skeleton */}
      <EuiFlexGroup>
        {/* Main content */}
        <EuiFlexItem grow={3}>
          <EuiPanel>
            <EuiSkeletonTitle size="s" />
            <EuiSpacer size="m" />
            <EuiSkeletonText lines={4} />
            <EuiSpacer size="l" />
            <EuiSkeletonTitle size="s" />
            <EuiSpacer size="m" />
            <EuiSkeletonText lines={3} />
          </EuiPanel>
        </EuiFlexItem>

        {/* Side panel */}
        <EuiFlexItem grow={1}>
          <EuiPanel>
            <EuiSkeletonTitle size="s" />
            <EuiSpacer size="m" />
            <EuiSkeletonText lines={6} />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
}

// Skeleton for cards/stats
export function StatsSkeleton() {
  return (
    <EuiFlexGroup gutterSize="l">
      {[1, 2, 3, 4].map((i) => (
        <EuiFlexItem key={i}>
          <EuiPanel paddingSize="m">
            <EuiSkeletonText lines={1} />
            <EuiSpacer size="s" />
            <EuiSkeletonTitle size="l" />
          </EuiPanel>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );
}

// Skeleton for forms
export function FormSkeleton() {
  return (
    <EuiPanel paddingSize="l">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <EuiSkeletonRectangle width="30%" height={16} />
          <EuiSpacer size="s" />
          <EuiSkeletonRectangle width="100%" height={40} />
        </div>
      ))}

      <EuiSpacer size="l" />

      <EuiFlexGroup justifyContent="flexEnd">
        <EuiFlexItem grow={false}>
          <EuiSkeletonRectangle width={100} height={40} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiSkeletonRectangle width={100} height={40} />
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
