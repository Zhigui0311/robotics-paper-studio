# 多维分类

一篇论文可有多个标签；稳定英文 slug 用于检索，中文解释写在笔记。没有证据则留空，不从标题猜机器人接口。

| 维度 | 可复用标签示例 |
|---|---|
| domain | robotics, embodied-ai, motion-control, motion-planning, perception |
| task | pick-and-place, manipulation, bimanual-manipulation, dexterous-manipulation, deformable-manipulation, assembly, locomotion, navigation, mobile-manipulation |
| method | imitation-learning, behavior-cloning, reinforcement-learning, diffusion-policy, action-chunking, vla, world-model, mpc, trajectory-optimization, sampling-based-planning, whole-body-control, impedance-control, admittance-control, system-identification, hybrid-control |
| embodiment | single-arm, dual-arm, dexterous-hand, quadruped, humanoid, mobile-manipulator, aerial-robot |
| observation | rgb, depth, point-cloud, tactile, force-torque, proprioception, language, privileged-state |
| action | joint-position, joint-velocity, joint-torque, eef-pose, eef-delta-pose, gripper, contact-force, trajectory, discrete-skill |
| validation | simulation, real-robot, sim-to-real, theoretical, dataset, benchmark, survey |
| custom | 用户项目/收藏集标签，可保留中文 |

这些是起始词表，不是封闭枚举。新概念可增加标签；先搜索已有同义词，避免 `dual-arm`/`two-arm` 等重复分类。论文主类别取其核心研究问题，另加交叉标签。

“已读”与主题分开：`queued` 待读、`skimmed` 初读、`analyzed` 已分析。证据等级也独立：`metadata`、`abstract`、`fulltext`、`fulltext+code`。`analyzed` 要有全文证据和笔记；能读摘要不等于全文精读。

相同论文不复制到多个分类文件夹。脚本从单一记录生成分类索引，分类变更不会改变论文 ID 或笔记路径。
