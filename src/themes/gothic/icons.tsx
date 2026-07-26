/**
 * @file icons.tsx
 * @input Uses lucide-react icon components, IconRegistry type
 * @output Exports gothicIconRegistry for the neutral theme
 * @position Icon configuration for the neutral theme; consumed by index.ts
 *
 * Maps semantic icon names to Lucide icon components.
 * These icons are bundled with the theme, not with @astryxdesign/core.
 */

// `React` has to stay imported as a value: `astryx theme build` compiles this
// file with the classic JSX runtime and emits React.createElement calls, even
// though Vite uses the automatic runtime. The type annotation on `iconProps`
// below is what keeps `noUnusedLocals` from flagging it.
import React from 'react';
import type {IconRegistry} from '@astryxdesign/core/Icon';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns,
  Copy,
  ExternalLink,
  EyeOff,
  Filter,
  Info,
  Menu,
  Mic,
  MoreHorizontal,
  Search,
  Square,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';

const iconProps: React.SVGProps<SVGSVGElement> & {size: string} = {
  size: '1em',
  'aria-hidden': true,
};

export const gothicIconRegistry: IconRegistry = {
  close: <X {...iconProps} />,
  chevronDown: <ChevronDown {...iconProps} />,
  chevronLeft: <ChevronLeft {...iconProps} />,
  chevronRight: <ChevronRight {...iconProps} />,
  check: <Check {...iconProps} />,
  success: <CheckCircle {...iconProps} />,
  error: <XCircle {...iconProps} />,
  warning: <AlertTriangle {...iconProps} />,
  info: <Info {...iconProps} />,
  calendar: <Calendar {...iconProps} />,
  clock: <Clock {...iconProps} />,
  externalLink: <ExternalLink {...iconProps} />,
  menu: <Menu {...iconProps} />,
  moreHorizontal: <MoreHorizontal {...iconProps} />,
  search: <Search {...iconProps} />,
  arrowUp: <ArrowUp {...iconProps} />,
  arrowDown: <ArrowDown {...iconProps} />,
  arrowsUpDown: <ArrowUpDown {...iconProps} />,
  funnel: <Filter {...iconProps} />,
  eyeSlash: <EyeOff {...iconProps} />,
  viewColumns: <Columns {...iconProps} />,
  copy: <Copy {...iconProps} />,
  checkDouble: <CheckCheck {...iconProps} />,
  wrench: <Wrench {...iconProps} />,
  stop: <Square {...iconProps} />,
  microphone: <Mic {...iconProps} />,
};
