# ADR-001: Use Elastic EUI for UI Components

## Status

Accepted

## Context

ECK UI needs a consistent, professional look that aligns with Elastic's design language. Users familiar with Elastic Cloud or Kibana should feel at home when using ECK UI.

We evaluated several options:

- **Elastic EUI**: Official Elastic UI framework, used by Kibana and Elastic Cloud
- **Material-UI**: Popular React component library with Material Design
- **Ant Design**: Enterprise-grade React component library
- **Chakra UI**: Lightweight, accessible component library
- **Custom components**: Build from scratch with Tailwind CSS

## Decision

We will use Elastic EUI (Elastic User Interface) as our primary component library.

## Consequences

### Positive

- **Brand consistency**: UI looks and feels like Elastic Cloud, reducing user learning curve
- **Rich components**: Table, forms, flyouts, and data visualization components are pre-built
- **Accessibility**: EUI components are WCAG 2.1 compliant out of the box
- **Elastic theming**: Light/dark mode and Elastic typography included
- **Well-documented**: Comprehensive documentation and examples available

### Negative

- **Bundle size**: EUI is relatively large (~500KB gzipped)
- **Learning curve**: EUI patterns differ from other component libraries
- **Elastic-specific**: Not usable for other projects without Elastic branding
- **Version coupling**: Must stay compatible with EUI's React version requirements

### Mitigations

- Tree-shaking to reduce bundle size where possible
- Document common EUI patterns internally for the team
- Pin to specific EUI version and test upgrades carefully

## References

- [EUI Documentation](https://eui.elastic.co/)
- [EUI GitHub Repository](https://github.com/elastic/eui)
