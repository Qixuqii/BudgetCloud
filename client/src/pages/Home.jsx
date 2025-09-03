import React, { useEffect } from "react";
import { Card, Title, Text } from "@tremor/react";

const Home = () => {
  const [list, setList] = React.useState([]);
  useEffect(() => {
    fetch("/api/transactions?type=income").then((res) => {
      res.json().then((data) => {
        debugger;
        setList(data);
      });
    });
  }, []);
  return (
    <div className="p-6">
      <Card>
        <Title>Welcome</Title>
        <Text>Now using Tremor + Tailwind.</Text>
      </Card>
      {list.map((item) => (
        <div key={item.id}>
          {item.id} - {item.amount} - {item.type}
        </div>
      ))}
    </div>
  );
};

export default Home;
