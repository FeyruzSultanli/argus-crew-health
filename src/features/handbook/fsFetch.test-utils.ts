// Test helper: serve seed/handbook/** through a fetch stub (the loaders fetch them at run time).
const FILES = import.meta.glob<string>('../../../seed/handbook/*.{md,json}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const BY_NAME = new Map(Object.entries(FILES).map(([path, text]) => [path.split('/').pop() ?? path, text]));

export function fsFetch(input: RequestInfo | URL): Promise<Response> {
  const name = /seed\/handbook\/([a-z0-9-]+\.(?:md|json))$/.exec(String(input))?.[1];
  const text = name ? BY_NAME.get(name) : undefined;
  return Promise.resolve(
    text === undefined ? new Response('not found', { status: 404 }) : new Response(text),
  );
}
