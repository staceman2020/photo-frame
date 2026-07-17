import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { LibraryPage } from '../features/library/LibraryPage';
import { UploadPage } from '../features/upload/UploadPage';
import { TagsPage } from '../features/tags/TagsPage';
import { LayoutsPage } from '../features/layouts/LayoutsPage';
import { FiltersPage } from '../features/filters/FiltersPage';
import { SlideshowPage } from '../features/slideshow/SlideshowPage';
import { SettingsPage } from '../features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'layouts', element: <LayoutsPage /> },
      { path: 'filters', element: <FiltersPage /> },
      { path: 'slideshow', element: <SlideshowPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
