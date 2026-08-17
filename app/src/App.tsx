import { useEffect } from 'react';
import { useRoute } from './app/router';
import { useStore } from './store';
import { getProject } from './io/db';
import { migrateProject } from './engine/migrate';
import { Launcher } from './ui/Launcher';
import { Editor } from './ui/Editor';
import { ShotPage } from './ui/ShotPage';

export default function App() {
  const route = useRoute();
  const project = useStore((s) => s.project);
  const loadProject = useStore((s) => s.loadProject);

  // 编辑器路由:确保对应项目已装载(刷新后恢复);装载即过迁移链,旧版本数据升级到当前
  useEffect(() => {
    if (route.name === 'editor' && project?.id !== route.projectId) {
      void getProject(route.projectId).then((p) => {
        if (p) loadProject(migrateProject(p));
        else location.hash = '/';
      });
    }
  }, [route, project, loadProject]);

  if (route.name === 'shot') return <ShotPage docId={route.docId} aspect={route.aspect} />;
  if (route.name === 'editor' && project) return <Editor />;
  return <Launcher />;
}
