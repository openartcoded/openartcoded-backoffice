import { useEffect, useRef } from 'react';
import { PageTitle } from '@/components/common';
import { getConfig } from '@/config';
import { getToken } from '@/auth/keycloak';
import '@zazuko/yasgui/build/yasgui.min.css';

const DEFAULT_QUERY = `PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX cv: <http://rdfs.org/resume-rdf/cv.rdfs#>
PREFIX baseCv: <http://rdfs.org/resume-rdf/base.rdfs#>
CONSTRUCT {?s ?p ?o}
WHERE {
  graph <https://bittich.be/graphs/public>{
    ?s ?p ?o
  }
}`;

/** yasgui sparql editor, queries are sent with the bearer token */
export function SparqlPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Sparql Endpoint';
    const element = ref.current;
    let token: string | undefined;
    let cancelled = false;
    let refresh: ReturnType<typeof setInterval>;
    (async () => {
      const [{ default: Yasgui }] = await Promise.all([import('@zazuko/yasgui')]);
      token = await getToken();
      // the token is refreshed regularly, yasgui reads it on each query
      refresh = setInterval(async () => (token = await getToken()), 30_000);
      if (cancelled || !element) return;
      const config = getConfig();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Y = Yasgui as any;
      Y.Yasqe.defaults.value = config.SPARQL_DEFAULT_QUERY || DEFAULT_QUERY;
      new Y(element, {
        requestConfig: {
          endpoint: config.SPARQL_ENDPOINT,
          defaultGraphs: [],
          method: 'POST',
          headers: () => ({ Authorization: `Bearer ${token}` }),
        },
        autofocus: true,
      });
    })();
    return () => {
      cancelled = true;
      clearInterval(refresh);
      if (element) element.innerHTML = '';
    };
  }, []);

  return (
    <>
      <PageTitle title="Sparql Endpoint" />
      <div ref={ref} />
    </>
  );
}
