# Contribuir a PETTZI

Gracias por tu interés en contribuir.

Este repositorio se publica como referencia técnica y portafolio. Aunque el producto ya no continúa como SaaS comercial, siguen siendo bienvenidas mejoras puntuales que mantengan la calidad, claridad y valor educativo del código.

## Alcance esperado

Se priorizan contribuciones pequeñas y bien enfocadas, por ejemplo:

- correcciones de bugs
- mejoras de documentación
- refactors acotados
- tests faltantes en áreas tocadas
- ajustes de DX o mantenimiento

No se aceptan cambios que introduzcan una nueva arquitectura, nuevos servicios de AWS o cambios amplios de producto sin discusión previa.

## Antes de empezar

1. Abre un issue o describe claramente el cambio propuesto.
2. Mantén el cambio enfocado en un solo problema.
3. Respeta la estructura del monorepo y los bounded contexts existentes.

## Reglas importantes

- Usa `nx` para ejecutar tareas del workspace.
- Mantén los handlers de Lambda delgados; la lógica de negocio debe vivir en servicios o libs.
- No cambies flujos de autenticación/autorización sin aprobación explícita.
- No cambies patrones de claves de DynamoDB ni diseño de tablas sin aprobación explícita.
- Si cambias una API, actualiza también su contrato OpenAPI.

## Validación local

Ejecuta, según aplique al cambio:

```bash
npx nx lint <project>
npx nx test <project>
npx nx build <project>
```

Si el cambio afecta varios proyectos, usa:

```bash
npx nx run-many -t lint test build --projects=<project1,project2>
```

## Pull requests

Al abrir un PR:

- explica el problema y la solución
- menciona cualquier tradeoff relevante
- incluye pruebas o evidencia de validación
- evita mezclar cambios no relacionados

## Calidad esperada

- cobertura adecuada en archivos tocados
- documentación actualizada cuando aplique
- cambios mínimos, legibles y mantenibles

Si no estás seguro de si un cambio encaja con el propósito actual del repositorio, abre primero una discusión.
