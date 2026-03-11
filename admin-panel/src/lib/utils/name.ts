/**
 * Splits a full name into first name and last name components.
 * 
 * @param name - The full name to split
 * @returns An object containing first_name and last_name
 * 
 * @example
 * splitFullName("John Doe") // { first_name: "John", last_name: "Doe" }
 * splitFullName("Mary Jane Watson") // { first_name: "Mary", last_name: "Jane Watson" }
 * splitFullName("Prince") // { first_name: "Prince", last_name: "" }
 */
export function splitFullName(name: string): { first_name: string; last_name: string } {
  const [first_name, ...rest] = name.trim().split(/\s+/);
  return { 
    first_name: first_name || "", 
    last_name: rest.join(" ") 
  };
}
