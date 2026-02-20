useEffect(() => {
  (async () => {
    const res = await fetch("/api/locations", {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    const json = await res.json();

    if (!json.ok) {
      setStatus(`Locations error: ${json.error}`);
      setAreas([]);
      setAreaId("");
      return;
    }

    const list = (json.locations ?? []) as Area[];
    setAreas(list);

    setAreaId((prev) => {
      if (!list.length) return "";
      return list.some((a) => a.id === prev) ? prev : list[0].id;
    });
  })();
}, []);
