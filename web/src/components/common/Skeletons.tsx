import {
  EuiSkeletonText,
  EuiSkeletonRectangle,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
} from '@elastic/eui';

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <EuiSkeletonRectangle width="100%" height="40px" />
      <EuiSpacer size="m" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <EuiSkeletonText lines={1} />
          <EuiSpacer size="s" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div>
      <EuiSkeletonRectangle width="300px" height="32px" />
      <EuiSpacer size="l" />
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiPanel>
            <EuiSkeletonText lines={4} />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiSkeletonText lines={4} />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiPanel>
        <EuiSkeletonText lines={6} />
      </EuiPanel>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div>
      <EuiSkeletonRectangle width="200px" height="28px" />
      <EuiSpacer size="l" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i}>
          <EuiSkeletonRectangle width="120px" height="16px" />
          <EuiSpacer size="s" />
          <EuiSkeletonRectangle width="100%" height="40px" />
          <EuiSpacer size="m" />
        </div>
      ))}
      <EuiSpacer size="l" />
      <EuiSkeletonRectangle width="120px" height="40px" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <EuiFlexGroup>
        {Array.from({ length: 4 }, (_, i) => (
          <EuiFlexItem key={i}>
            <EuiPanel>
              <EuiSkeletonText lines={3} />
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiPanel>
        <EuiSkeletonText lines={8} />
      </EuiPanel>
    </div>
  );
}
